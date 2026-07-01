export const currency = (value) => {
  const numberValue = Number(value || 0);
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
  }).format(numberValue);
};
