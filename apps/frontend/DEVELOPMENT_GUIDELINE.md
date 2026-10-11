# Hướng dẫn Phát triển & Tiêu chuẩn Code (Development Guidelines)

Tài liệu này cung cấp các tiêu chuẩn về format code, cách xây dựng layout responsive, cách thiết lập bảng dữ liệu (DataTable) với các thao tác Create/Edit/Delete chuẩn hóa trong dự án.

## 1. Tiêu chuẩn Format Code & Linting
Dự án sử dụng Prettier và ESLint một cách chặt chẽ. Đảm bảo IDE (VSCode) của bạn đã cài đặt và cấu hình tự động format khi lưu (format on save).

### Prettier (`.prettierrc`)
- **Dấu chấm phẩy (Semicolons):** KHÔNG dùng (`semi: false`).
- **Nháy đơn/kép:** Dùng nháy kép (`singleQuote: false`).
- **Độ rộng Tab:** 2 spaces.
- **Tailwind Plugin:** Tự động sắp xếp class tailwind với `prettier-plugin-tailwindcss`. Hỗ trợ sắp xếp bên trong hàm `cn()` và `cva()`.

### ESLint (`eslint.config.mjs`)
- **Unused Imports:** Sẽ báo lỗi (Error) nếu có thư viện import mà không sử dụng.
- **Unused Variables:** Báo cảnh báo (Warning). Các biến bắt đầu bằng `_` sẽ được bỏ qua.

## 2. Layout & Responsive Design
Sử dụng hệ thống Grid/Flex của Tailwind CSS để tạo layout responsive.

### Form Layout Pattern
Đối với các form tạo mới hoặc chỉnh sửa (thường nằm trong Dialog/Modal), sử dụng `grid` để chia cột responsive:

```tsx
<div className="grid gap-4">
  {/* Full width trên mọi màn hình */}
  <FormInput name="address" label="Địa chỉ" />
  
  {/* 1 cột trên mobile, 2 cột trên màn hình từ md trở lên */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <FormInput name="email" label="Email" type="email" />
    <FormInput name="phone" label="Số điện thoại" type="tel" />
  </div>
</div>
```

## 3. Cách tạo Bảng dữ liệu (Data Table) chuẩn
Dự án sử dụng `@tanstack/react-table` được bọc qua component `<DataTable />` dùng chung. Một luồng (flow) chuẩn bao gồm 2 phần: **Định nghĩa Cột** (Columns) và **Giao diện Bảng** (Table View).

### Phần 1: Định nghĩa Columns và Action Edit/Delete (`features/[feature-name]/columns.tsx`)
Mọi thao tác Edit (Chỉnh sửa) và Delete (Xóa) đều được tích hợp thẳng vào cột cuối cùng (Actions) bằng cách mở Modal (`Dialog`).

```tsx
"use client"

import { ColumnDef, Row, Table } from "@tanstack/react-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { CommonDialog } from "@/components/common-dialog"
import { Button } from "@/components/ui/button"
import { FormInput } from "@/components/ui-custom/form-input"
import { useState } from "react"

const ActionCell = ({ row, table }: { row: Row<any>, table: Table<any> }) => {
  const data = row.original
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  
  // Lấy hàm xử lý API từ meta props của table
  const { refetch, deleteItem } = table.options.meta as any || {}

  const handleUpdate = async () => {
    // 1. Validate form
    // 2. Gọi API update
    // 3. Đóng modal & refetch data
    setIsEditOpen(false)
    refetch?.()
  }

  return (
    <div className="flex w-fit gap-1 font-medium whitespace-nowrap">
      {/* Nút mở Modal Chỉnh sửa */}
      <Button size="sm" onClick={() => setIsEditOpen(true)}>Chi tiết / Edit</Button>
      
      {/* Modal Chỉnh sửa (Edit Modal) */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Cập nhật thông tin</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
             {/* Sử dụng FormInput, FormTextarea từ thư viện nội bộ */}
             <FormInput label="Tên" value={data.name} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Hủy</Button>
            <Button onClick={handleUpdate}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Xác nhận Xóa */}
      <CommonDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        trigger={<Button size="sm" variant="destructive">Xóa</Button>}
        title="Xác nhận xóa"
        description="Bạn có chắc chắn muốn xóa mục này không?"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Hủy</Button>
            <Button variant="destructive" onClick={() => deleteItem(data.id)}>Xóa</Button>
          </div>
        }
      />
    </div>
  )
}

export const dataColumns: ColumnDef<any>[] = [
  {
    accessorKey: "name",
    header: "Tên",
    cell: ({ row }) => <span className="font-medium text-gray-800">{row.getValue("name")}</span>,
  },
  {
    accessorKey: "actions",
    header: "Thao tác",
    size: 110,
    cell: ({ row, table }) => <ActionCell row={row} table={table} />,
  }
]
```

### Phần 2: Hiển thị DataTable & Logic Pagination (`app/.../_components/feature-table.tsx`)
Việc gọi dữ liệu API, phân trang (pagination) và xử lý state tìm kiếm được thực hiện ở component cha và truyền xuống `<DataTable />`. Nút tạo mới (Create Modal) được đặt phía trên bảng.

```tsx
"use client"

import { useState, useMemo } from "react"
import { DataTable } from "@/components/data-table"
import { LoadingPlaceholder } from "@/components/loading-placeholder"
import { dataColumns } from "@/features/[feature-name]/columns"
import { PAGE_SIZE_DEFAULT } from "@/constants/common"
import CreateModal from "./create-modal"

export default function FeatureTable({ externalParams }) {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE_DEFAULT,
  })

  // Format params để gọi API
  const apiParams = useMemo(() => ({
    ...externalParams,
    page: pagination.pageIndex,
    size: pagination.pageSize,
  }), [externalParams, pagination])

  // Giả định dùng custom hook gọi API
  const { data, isLoading, refetch, deleteItem } = useFeatureApi(apiParams)
  
  if (isLoading && !data) return <LoadingPlaceholder />

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
         {/* Modal tạo mới luôn đặt trên bảng */}
        <CreateModal onCreated={refetch} />
      </div>
      
      <DataTable
        data={data?.content || []}
        columns={dataColumns}
        getRowId={(row) => row.id}
        pageCount={data?.totalPages || 0}
        pagination={pagination}
        onPaginationChange={setPagination}
        manualPagination /* Bắt buộc bật thủ công để API server xử lý */
        meta={{
          // Truyền các hàm mutate xuống ActionCell thông qua meta
          deleteItem,
          refetch,
        }}
      />
    </div>
  )
}
```

## 4. Tóm tắt nguyên tắc sử dụng Component thư viện
- **Luôn dùng các form field từ** `components/ui-custom` (ví dụ `FormInput`, `FormTextarea`) thay vì dùng thẻ `<input>` thuần, để đảm bảo thống nhất UI và lỗi validation.
- **Sử dụng** `CommonDialog` cho những popup xác nhận (confirm popup) như Xóa.
- **Sử dụng** `Dialog` (từ `components/ui/dialog`) cho những popup phức tạp có form (Edit/Create).
- **Luôn truyền `refetch`** callback từ parent vào trong các Modal Create/Edit để bảng dữ liệu tự động cập nhật ngay khi lưu thành công.
