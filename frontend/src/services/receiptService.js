import api from "./api";

const triggerBlobDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const getReceiptPdfBlob = async (paymentId, language = "fr") => {
  const response = await api.get(`/api/receipts/${paymentId}/pdf`, {
    params: { lang: language === "ar" ? "ar" : "fr" },
    responseType: "blob",
  });

  const contentType = response.headers["content-type"] || "";
  if (contentType.includes("application/json")) {
    const text = await response.data.text();
    const payload = JSON.parse(text);
    throw new Error(payload.message || payload.code || "RECEIPT_PDF_ERROR");
  }

  const filename = `recu-paiement-${paymentId}.pdf`;
  const blob = new Blob([response.data], { type: "application/pdf" });
  return { blob, filename };
};

export const downloadReceiptPdf = async (paymentId, language = "fr") => {
  const { blob, filename } = await getReceiptPdfBlob(paymentId, language);
  triggerBlobDownload(blob, filename);
  return filename;
};

export const getReceiptData = async (paymentId, language = "fr") => {
  const response = await api.get(`/api/receipts/${paymentId}`, {
    params: { lang: language === "ar" ? "ar" : "fr" },
  });
  return response.data;
};
