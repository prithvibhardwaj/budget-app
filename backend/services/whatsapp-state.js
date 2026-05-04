let qr = null;
module.exports = {
  getQR: () => qr,
  setQR: (v) => { qr = v; },
  clearQR: () => { qr = null; },
};
