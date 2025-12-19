import { putLockTerm } from "../models/termModel.js";

let lastRun = 0;

export const autoLockTerm = async (req, res, next) => {
  try {
    const dateNow = Date.now();

    // Chạy mỗi 10 phút
    if (dateNow - lastRun > 10 * 60 * 1000) {
      await putLockTerm();
      lastRun = now;
    }

  } catch (errorr) {
    console.error("Lỗi ở ", errorr);
  }
};
