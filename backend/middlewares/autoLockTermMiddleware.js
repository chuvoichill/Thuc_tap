import { putLockTerm } from "../models/termModel.js";

let date = null;

export const autoLockTerm = async (req, res,next) => {
  try {
    const dateNow = new Date();
    const dateToday = dateNow.toISOString().slice(0,10);

    //ktra hang ngay
    if (date !== dateToday && dateNow.getHours() === 0) {
      await putLockTerm(); date = dateToday; 
    }

  } catch (errorr) {
    console.error("Lỗi ở autoLockTerm", errorr);
  }
  next();
};
