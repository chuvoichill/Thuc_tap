import ExcelJS from "exceljs";
import { reportFaculty } from "../models/reportModel.js";

export const previewTemplateExcel = async (req, res) =>{
    const {term_code,faculty_code} = req.query;
    console.log("term_code:", term_code, "faculty_code:", faculty_code);

    if (!term_code || !faculty_code)    return res.status(400).send("Thiếu dữ liệu đầu vào: term_code hoặc faculty_code");

    try {
        const data = await reportFaculty(term_code, faculty_code);

        //Neu chua co sinh vien nao
        if (data.length === 0) {
            return res.status(404).send();
        }

        //Da co sinh vien danh gia
        return res.json({
            title: `TỔNG HỢP KQRL HK ${data[0].semester} NĂM ${data[0].year} - ${data[0].year + 1}`,
            faculty: data[0].name,
            columns: ["TT", "Mã SV", "Họ và tên", "Lớp", "Khoa", "DRL", "Phân loại"],
            rows: data.map((item, index) => ({
                tt: index + 1,
                student_code: item.student_code,
                full_name: item.full_name,
                class_code: item.class_code,
                faculty: item.name,
                total_score: item.total_score,
                rank: item.rank
            }))
        });
        
    } catch (error) {
        console.error("Lỗi ở previewTemplateExcel",error);
        res.status(500).send("Lỗi hệ thống");
    }

};

export const exportTemplateExcel = async (req, res) => {
    const { term_code, faculty_code } = req.query;
    if (!term_code || !faculty_code)    return res.status(400).send("Thiếu dữ liệu đầu vào: term_code hoặc faculty_code");
    
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
        sheet.getCell("A5").value =`TỔNG HỢP KQRL SINH VIÊN HỌC KỲ ${data[0].semester} NĂM HỌC ${data[0].year} - ${data[0].year+1}`;
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
            { key: "tt", width: 5 },
            { key: "masv", width: 15 },
            { key: "hoten", width: 30 },
            { key: "lop", width: 15 },
            { key: "khoa", width: 30 },
            { key: "drl", width: 10 },
            { key: "phanloai", width: 15 }
        ];

        sheet.getRow(7).font = { bold: true };
        sheet.getRow(7).alignment = center;
        sheet.getRow(7).eachCell(cell => (cell.border = border));

        data.forEach((item, index) => {
            const row = sheet.addRow([index + 1, item.student_code, item.full_name, item.class_code, item.name, item.total_score, item.rank]);
            
            row.eachCell(cell => {
                cell.border = border;
            });
        });

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=Bao_cao_template.xlsx"
        );

        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error(error);
        res.status(500).send("Lỗi khi tạo file Excel");
    }
};
