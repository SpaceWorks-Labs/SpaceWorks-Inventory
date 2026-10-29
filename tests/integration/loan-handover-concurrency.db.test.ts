import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createItem } from "@/lib/catalogue/items";
import { newQrCode } from "@/lib/catalogue/qr";
import { receiveStock } from "@/lib/inventory/availability";
import { approveLoan, issueLoan, requestLoan, selfCheckout } from "@/lib/lending/workflow";
import { checkBorrowingEligibility } from "@/lib/lending/access";
import { cleanup, seedSpace, uniqueSuffix } from "../helpers/fixtures";
import { evidence } from "../helpers/evidence";

let ctx: Awaited<ReturnType<typeof seedSpace>>;
const system = { userId: null };
beforeAll(async () => { ctx = await seedSpace(uniqueSuffix()); });
afterAll(async () => { if (ctx) await cleanup([ctx.space.slug], ctx.domain); });

async function prepare() {
  const borrower = await prisma.user.create({ data: { email: `${uniqueSuffix()}${ctx.domain}`, emailVerified: new Date() } });
  await prisma.membership.create({ data: { spaceId: ctx.space.id, userId: borrower.id, role: "MEMBER" } });
  const item = await prisma.$transaction((tx) => createItem(tx, ctx.space.id, { name: uniqueSuffix(), lendable: true, selfCheckout: true }, system));
  await prisma.$transaction((tx) => receiveStock(tx, { spaceId: ctx.space.id, itemId: item.id, locationId: ctx.shelfA.id, quantity: 4 }, system));
  return { borrower, item };
}

async function approved(borrowerId: string, itemId: string) {
  const loan = await prisma.$transaction((tx) => requestLoan(tx, { spaceId: ctx.space.id, borrowerId, lines: [{ itemId, quantity: 1 }], purpose: null, neededFrom: null }, system));
  await prisma.$transaction((tx) => approveLoan(tx, { spaceId: ctx.space.id, loanId: loan.id, quantities: null }, system));
  return loan;
}

function handover(loanId: string, codes: string[]) {
  return prisma.$transaction((tx) => issueLoan(tx, { spaceId: ctx.space.id, loanId, scannedCodes: codes, evidence: { ...evidence(ctx.space.id), scannedCodes: codes } }, system), { timeout: 15_000 });
}

describe("serialized handover admission", () => {
  it.each(["desk", "self", "mixed"] as const)("enforces a shared loan limit for concurrent %s handovers", async (mode) => {
    await prisma.space.update({ where: { id: ctx.space.id }, data: { maxActiveLoans: 1, maxItemsOnLoan: 0, selfCheckoutEnabled: true } });
    const { borrower, item } = await prepare();
    const loans = mode === "self" ? [] : [await approved(borrower.id, item.id), ...(mode === "desk" ? [await approved(borrower.id, item.id)] : [])];
    const self = () => prisma.$transaction((tx) => selfCheckout(tx, { spaceId: ctx.space.id, borrowerId: borrower.id, scannedCodes: [item.qrCode], evidence: evidence(ctx.space.id) }, system), { timeout: 15_000 });
    const results = await Promise.allSettled([mode === "self" ? self() : handover(loans[0]!.id, [item.qrCode]), mode === "desk" ? handover(loans[1]!.id, [item.qrCode]) : self()]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "forbidden" } });
    expect(await prisma.loan.count({ where: { spaceId: ctx.space.id, borrowerId: borrower.id, status: "ISSUED" } })).toBe(1);
  });

  it("allows a container to be out on only one concurrent loan", async () => {
    const first = await prepare();
    const second = await prepare();
    const a = await approved(first.borrower.id, first.item.id);
    const b = await approved(second.borrower.id, second.item.id);
    const container = await prisma.container.create({ data: { spaceId: ctx.space.id, name: "Shared carrier", code: uniqueSuffix(), qrCode: newQrCode("container") } });
    const results = await Promise.allSettled([handover(a.id, [first.item.qrCode, container.qrCode]), handover(b.id, [second.item.qrCode, container.qrCode])]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "conflict" } });
  });

  it("rejects disabled users and repair-only technicians as borrowers", async () => {
    const { borrower } = await prepare();
    const check = () => checkBorrowingEligibility(prisma, { spaceId: ctx.space.id, userId: borrower.id, incomingUnits: 1 });
    expect(await check()).toEqual({ ok: true });
    await prisma.user.update({ where: { id: borrower.id }, data: { disabledAt: new Date() } });
    expect(await check()).toMatchObject({ ok: false, code: "standing" });
    await prisma.user.update({ where: { id: borrower.id }, data: { disabledAt: null } });
    await prisma.membership.update({ where: { userId_spaceId: { userId: borrower.id, spaceId: ctx.space.id } }, data: { role: "TECHNICIAN" } });
    expect(await check()).toMatchObject({ ok: false, code: "standing" });
  });
});
