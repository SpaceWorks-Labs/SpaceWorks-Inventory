import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Dropdown } from "@/components/ui/select";
import { PERIOD_GROUPS, type PeriodGroup } from "@/lib/finance/periods";

/** Period, grouping and the CSV / XLSX downloads (a plain GET form, so it works without JavaScript). */
export function FinanceToolbar({ fromDay, toDay, group, exportBase }: { fromDay: string; toDay: string; group: PeriodGroup; exportBase: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-panel p-4 lg:flex-row lg:items-end lg:justify-between">
      <form method="get" className="grid gap-3 sm:grid-cols-[minmax(0,170px)_minmax(0,170px)_minmax(0,170px)_auto] sm:items-end">
        <Field label="From"><Input type="date" name="from" defaultValue={fromDay} max={toDay} /></Field>
        <Field label="To"><Input type="date" name="to" defaultValue={toDay} /></Field>
        <Field label="Group by">
          <Dropdown name="group" defaultValue={group}>
            {PERIOD_GROUPS.map((entry) => <option key={entry.key} value={entry.key}>{entry.label}</option>)}
          </Dropdown>
        </Field>
        <Button type="submit" variant="secondary">Show</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary"><a href={`${exportBase}&format=csv`} download>Download CSV</a></Button>
        <Button asChild variant="secondary"><a href={`${exportBase}&format=xlsx`} download>Download XLSX</a></Button>
      </div>
    </div>
  );
}
