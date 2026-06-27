import { db } from "@/db";
import { currency } from "@/db/schema";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// better-sqlite3 is a native module — keep this RSC on the Node runtime.
export const dynamic = "force-dynamic";

export default async function CurrenciesPage() {
  const rows = await db
    .select({
      code: currency.code,
      name: currency.name,
      minorUnit: currency.minorUnit,
    })
    .from(currency)
    .orderBy(currency.code);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold leading-tight">币种</h1>
      <Table>
        <TableCaption className="text-sm text-muted-foreground">
          币种列表用于创建空间时选择,暂不支持在此编辑。
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">代码</TableHead>
            <TableHead scope="col">名称</TableHead>
            <TableHead scope="col" className="text-right">
              最小单位位数
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.code}>
              <TableCell className="font-mono">{row.code}</TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell className="text-right font-mono">
                {row.minorUnit}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
