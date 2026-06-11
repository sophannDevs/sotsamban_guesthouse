import type * as React from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type DataTableColumn<T> = {
  key: string
  header: string
  render: (row: T) => React.ReactNode
  className?: string
  headerClassName?: string
}

type DataTableProps<T> = {
  columns: DataTableColumn<T>[]
  data: T[]
  getRowId: (row: T) => string
  emptyLabel?: string
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  emptyLabel = "No records yet.",
}: DataTableProps<T>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              className={column.headerClassName}
              key={column.key}
              scope="col"
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length > 0 ? (
          data.map((row) => (
            <TableRow key={getRowId(row)}>
              {columns.map((column) => (
                <TableCell className={cn(column.className)} key={column.key}>
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell
              className="h-24 text-center text-muted-foreground"
              colSpan={columns.length}
            >
              {emptyLabel}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
