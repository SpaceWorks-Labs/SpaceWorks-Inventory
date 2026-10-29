import "server-only";

import type { Tx } from "@/lib/db";

/**
 * Different loans have different row locks, but share one borrowing limit.
 * Serialize handovers for that borrower before reading active loans. An
 * advisory lock avoids taking Membership out of order with return/incident
 * workflows, which can update the member's standing after moving stock.
 */
export async function lockBorrowingAllowance(tx: Tx, spaceId: string, borrowerId: string) {
  const key = JSON.stringify(["inventory-borrowing-allowance", spaceId, borrowerId]);
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
}
