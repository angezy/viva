/* Weluxo post-migration consistency checks.
   READ ONLY: this script contains SELECT statements only and returns exception rows.
   An empty result set for each check is a pass. */
SET NOCOUNT ON;

SELECT N'Order totals vs items' AS [CheckName], o.[Id], o.[OrderNumber], o.[TotalAmount] AS [HeaderTotal],
       COALESCE(SUM(oi.[TotalAmount]), 0) + o.[ShippingAmount] - o.[DiscountAmount] AS [CalculatedTotal]
FROM [Commerce].[Orders] o
LEFT JOIN [Commerce].[OrderItems] oi ON oi.[OrderId] = o.[Id]
GROUP BY o.[Id], o.[OrderNumber], o.[TotalAmount], o.[ShippingAmount], o.[DiscountAmount]
HAVING ABS(o.[TotalAmount] - (COALESCE(SUM(oi.[TotalAmount]), 0) + o.[ShippingAmount] - o.[DiscountAmount])) > 0.01;

SELECT N'Paid orders vs incoming payments' AS [CheckName], o.[Id], o.[OrderNumber], o.[TotalAmount], o.[RefundedAmount],
       COALESCE(SUM(CASE WHEN p.[Direction] = N'Incoming' AND p.[Status] IN (N'Paid', N'PartiallyRefunded', N'Refunded') THEN p.[Amount] ELSE 0 END), 0) AS [PaidAmount]
FROM [Commerce].[Orders] o
LEFT JOIN [ERP].[Payments] p ON p.[OrderId] = o.[Id]
WHERE o.[PaymentStatus] IN (N'Paid', N'PartiallyRefunded', N'Refunded')
GROUP BY o.[Id], o.[OrderNumber], o.[TotalAmount], o.[RefundedAmount]
HAVING ABS((o.[TotalAmount] - o.[RefundedAmount]) - COALESCE(SUM(CASE WHEN p.[Direction] = N'Incoming' AND p.[Status] IN (N'Paid', N'PartiallyRefunded', N'Refunded') THEN p.[Amount] ELSE 0 END), 0)) > 0.01;

SELECT N'Refund totals vs order' AS [CheckName], o.[Id], o.[OrderNumber], o.[RefundedAmount], COALESCE(SUM(r.[Amount]), 0) AS [RefundRecords]
FROM [Commerce].[Orders] o
LEFT JOIN [ERP].[Refunds] r ON r.[OrderId] = o.[Id] AND r.[Status] IN (N'Paid', N'Processed', N'Completed')
GROUP BY o.[Id], o.[OrderNumber], o.[RefundedAmount]
HAVING ABS(o.[RefundedAmount] - COALESCE(SUM(r.[Amount]), 0)) > 0.01;

SELECT N'Posted journal imbalance' AS [CheckName], je.[Id], je.[JournalNumber], SUM(jl.[DebitAmount]) AS [Debits], SUM(jl.[CreditAmount]) AS [Credits]
FROM [ERP].[JournalEntries] je
JOIN [ERP].[JournalLines] jl ON jl.[JournalEntryId] = je.[Id]
WHERE je.[Status] = N'Posted'
GROUP BY je.[Id], je.[JournalNumber]
HAVING ABS(SUM(jl.[DebitAmount]) - SUM(jl.[CreditAmount])) > 0.01;

SELECT N'Invoice balance' AS [CheckName], i.[Id], i.[InvoiceNumber], i.[TotalAmount], i.[PaidAmount], i.[BalanceAmount]
FROM [ERP].[Invoices] i
WHERE ABS(i.[BalanceAmount] - (i.[TotalAmount] - i.[PaidAmount])) > 0.01;

SELECT N'Supplier bill balance' AS [CheckName], b.[Id], b.[BillNumber], b.[TotalAmount], b.[PaidAmount], b.[BalanceAmount]
FROM [ERP].[SupplierBills] b
WHERE ABS(b.[BalanceAmount] - (b.[TotalAmount] - b.[PaidAmount])) > 0.01;

SELECT N'Supplier item cost snapshot' AS [CheckName], oi.[Id] AS [OrderItemId], oi.[UnitCost], soi.[UnitCost] AS [SupplierUnitCost]
FROM [Commerce].[OrderItems] oi
JOIN [Commerce].[SupplierOrderItems] soi ON soi.[OrderItemId] = oi.[Id]
WHERE oi.[UnitCost] IS NOT NULL AND ABS(oi.[UnitCost] - soi.[UnitCost]) > 0.01;

SELECT N'Orphan canonical customer reference' AS [CheckName], o.[Id], o.[OrderNumber], o.[CustomerId]
FROM [Commerce].[Orders] o
LEFT JOIN [CRM].[Customers] c ON c.[Id] = o.[CustomerId]
WHERE o.[CustomerId] IS NOT NULL AND c.[Id] IS NULL;

SELECT N'Overview revenue source' AS [CheckName], o.[Currency],
       SUM(o.[TotalAmount] - o.[RefundedAmount]) AS [NetRevenue], COUNT_BIG(*) AS [RevenueOrderCount]
FROM [Commerce].[Orders] o
WHERE o.[OrderStatus] <> N'Cancelled' AND o.[PaymentStatus] IN (N'Paid', N'PartiallyRefunded', N'Refunded')
GROUP BY o.[Currency];
