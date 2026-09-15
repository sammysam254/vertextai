import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  children: ReactNode;
}

export function Table({ className, children, ...props }: TableProps) {
  return (
    <div className="table-container">
      <table className={cn('table', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode;
}

export function TableHeader({ className, children, ...props }: TableHeaderProps) {
  return (
    <thead className={className} {...props}>
      {children}
    </thead>
  );
}

export interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode;
}

export function TableBody({ className, children, ...props }: TableBodyProps) {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  );
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  children: ReactNode;
}

export function TableRow({ className, children, ...props }: TableRowProps) {
  return (
    <tr className={className} {...props}>
      {children}
    </tr>
  );
}

export interface TableHeadProps extends HTMLAttributes<HTMLTableCellElement> {
  children: ReactNode;
}

export function TableHead({ className, children, ...props }: TableHeadProps) {
  return (
    <th className={className} {...props}>
      {children}
    </th>
  );
}

export interface TableCellProps extends HTMLAttributes<HTMLTableCellElement> {
  children: ReactNode;
}

export function TableCell({ className, children, ...props }: TableCellProps) {
  return (
    <td className={className} {...props}>
      {children}
    </td>
  );
}
