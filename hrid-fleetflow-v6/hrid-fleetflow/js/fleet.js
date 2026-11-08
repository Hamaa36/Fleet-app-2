// HRID company vehicles (ئۆتۆمبێلەکانی کۆمپانیا). Edit this list when vehicles are added or sold.
export const FLEET = [
  { no: 1, model: "Toyota Hilux", plate: "21 A 666" },
  { no: 2, model: "Toyota Hilux", plate: "21 A 749" },
  { no: 4, model: "Toyota Hilux", plate: "21 K 13301" },
  { no: 5, model: "Toyota RAV4", plate: "21 J 40816" },
  { no: 6, model: "Toyota RAV4", plate: "21 B 10008" },
  { no: 7, model: "Toyota Corolla Cross", plate: "21 K 48592" },
  { no: 8, model: "Toyota Corolla Cross", plate: "21 K 49351" },
  { no: 9, model: "Nissan Patrol", plate: "21 B 10009" },
  { no: 10, model: "Nissan Patrol", plate: "21 B 10001" },
];
// Plates are wrapped in a left-to-right isolate so "21 B 10001" stays in order inside Kurdish (right-to-left) text.
export const ltr = (s) => `\u2066${s}\u2069`;
export const vehicleModel = (plate) => FLEET.find((v) => v.plate === plate)?.model || "";
export const vehicleLabel = (plate) => { const m = vehicleModel(plate); return plate ? (m ? `${m} · ${ltr(plate)}` : ltr(plate)) : "-"; };
export const fleetOptions = () => FLEET.map((v) => [v.plate, `${v.model} – ${ltr(v.plate)}`]);
