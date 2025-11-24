import ExcelJS from "exceljs";
import { reportFaculty } from "../models/reportModel.js";

export const exportTemplateExcel = async (req, res) => {
    const { term_code, faculty_code } = req.query;
    if (!term_code || !faculty_code) {
        return res.status(400).send("Thiếu dữ liệu đầu vào: term_code hoặc faculty_code");
    }
    try {
        const data = await reportFaculty(term_code, faculty_code);
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Báo cáo");

        const border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" }
        };

        const center = { vertical: "middle", horizontal: "center" };

        sheet.mergeCells("A1:G1");
        sheet.getCell("A1").value = `TỔNG HỢP KQRL SINH VIÊN HỌC KỲ ${data[0].semester} NĂM HỌC ${data[0].year} - ${data[0].year+1}`;
        sheet.getCell("A1").font = { size: 14, bold: true };
        sheet.getCell("A1").alignment = center;

        sheet.mergeCells("A2:G2");
        sheet.getCell("A2").value = "(Mẫu dùng cho Khoa)";
        sheet.getCell("A2").alignment = center;

        sheet.mergeCells("A3:G3");
        sheet.getCell("A3").value = `Khoa: ${data[0].name}`;
        sheet.getCell("A3").alignment = { horizontal: "left" };

        sheet.mergeCells("A5:G5");
        sheet.getCell("A5").value =
            `TỔNG HỢP KQRL SINH VIÊN HỌC KỲ ${data[0].semester} NĂM HỌC ${data[0].year} - ${data[0].year+1}`;
        sheet.getCell("A5").font = { size: 13, bold: true };
        sheet.getCell("A5").alignment = center;

        sheet.getRow(7).values = [
            "TT",
            "Mã SV",
            "Họ và tên",
            "Lớp",
            "Khoa",
            "DRL",
            "Phân loại"
        ];

        sheet.columns = [
            { key: "tt", width: 6 },
            { key: "masv", width: 15 },
            { key: "hoten", width: 28 },
            { key: "lop", width: 12 },
            { key: "khoa", width: 30 },
            { key: "drl", width: 10 },
            { key: "phanloai", width: 15 }
        ];

        sheet.getRow(7).font = { bold: true };
        sheet.getRow(7).alignment = center;
        sheet.getRow(7).eachCell(cell => (cell.border = border));

        data.forEach((item, index) => {
            const row = sheet.addRow([index, item.student_code, item.full_name, item.class_code, item.name, item.total_score, item.rank]);
            row.eachCell(cell => {
                cell.border = border;
                cell.alignment = center;
            });
        });

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=bao_cao_template.xlsx"
        );

        await workbook.xlsx.write(res);
        res.end(); // BẮT BUỘC PHẢI CÓ
        
    } catch (err) {
        console.error(err);
        res.status(500).send("Lỗi khi tạo file Excel");
    }
};
