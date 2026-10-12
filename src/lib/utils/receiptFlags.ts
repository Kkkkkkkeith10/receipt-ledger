import type { Receipt } from "$lib/types";

export type ReceiptFlagLevel = "attention" | "suspicious";

export interface ReceiptFlag {
  code:
    | "zero-amount"
    | "negative-amount"
    | "missing-vendor"
    | "future-date"
    | "missing-document"
    | "missing-purpose";
  level: ReceiptFlagLevel;
  label: string;
  detail: string;
}

type ReceiptLike = Partial<Receipt> | null | undefined;

function parseAmount(receipt: ReceiptLike) {
  return Number(receipt?.amount ?? 0);
}

function parseReceiptDate(receipt: ReceiptLike) {
  if (!receipt?.date) return null;
  const parsed = new Date(receipt.date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getReceiptFlags(receipt: ReceiptLike): ReceiptFlag[] {
  if (!receipt) return [];

  const flags: ReceiptFlag[] = [];
  const amount = parseAmount(receipt);
  const vendor = receipt.vendor?.trim() ?? "";
  const businessPurpose = receipt.auditInfo?.businessPurpose?.trim() ?? "";
  const date = parseReceiptDate(receipt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!Number.isFinite(amount) || amount === 0) {
    flags.push({
      code: "zero-amount",
      level: "suspicious",
      label: "Zero amount",
      detail: "Amount is zero or invalid. This should be checked before approval.",
    });
  } else if (amount < 0) {
    flags.push({
      code: "negative-amount",
      level: "suspicious",
      label: "Negative amount",
      detail: "Amount is negative. Verify whether this receipt should be a refund or credit note.",
    });
  }

  if (!vendor) {
    flags.push({
      code: "missing-vendor",
      level: "suspicious",
      label: "Missing vendor",
      detail: "Vendor name is empty.",
    });
  }

  if (date && date > today) {
    flags.push({
      code: "future-date",
      level: "suspicious",
      label: "Future date",
      detail: "Receipt date is in the future.",
    });
  }

  if (!receipt.receiptImageUrl && !receipt.receiptImageKey) {
    flags.push({
      code: "missing-document",
      level: "attention",
      label: "No attachment",
      detail: "No receipt image or PDF is attached.",
    });
  }

  if (!businessPurpose) {
    flags.push({
      code: "missing-purpose",
      level: "attention",
      label: "Missing purpose",
      detail: "Business purpose has not been filled in yet.",
    });
  }

  return flags;
}

export function isReceiptSuspicious(receipt: ReceiptLike) {
  return getReceiptFlags(receipt).some((flag) => flag.level === "suspicious");
}

export function getReceiptBlockingIssues(receipt: ReceiptLike) {
  if (!receipt) return ["Receipt is not loaded."];

  const issues: string[] = [];
  const amount = parseAmount(receipt);

  if (!receipt.vendor?.trim()) {
    issues.push("Vendor is required.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    issues.push("Amount must be greater than 0.");
  }

  if (!receipt.date?.trim()) {
    issues.push("Date is required.");
  }

  if (!receipt.category?.trim()) {
    issues.push("Category is required.");
  }

  return issues;
}