import ExcelJS from "exceljs";
import { reportFaculty, reportTeacher } from "../models/reportModel.js";

//Khoa
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

//Khoa
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

//GV
export const previewTeacherExcel = async (req, res) => {
    const { term_code, teacher_id } = req.query;
    console.log("📊 [TEACHER EXCEL PREVIEW] term_code:", term_code, "teacher_id:", teacher_id);

    if (!term_code || !teacher_id) {
        console.error("❌ [TEACHER EXCEL PREVIEW] Thiếu tham số:", { term_code, teacher_id });
        return res.status(400).json({ 
            error: "Thiếu dữ liệu đầu vào",
            message: "Vui lòng cung cấp đầy đủ term_code và teacher_id" 
        });
    }

    try {
        const data = await reportTeacher(term_code, teacher_id);
        console.log(`✅ [TEACHER EXCEL PREVIEW] Lấy được ${data.length} sinh viên`);

        if (data.length === 0) {
            console.warn("⚠️ [TEACHER EXCEL PREVIEW] Không có dữ liệu");
            return res.status(404).json({ 
                error: "Không có dữ liệu",
                message: "Chưa có dữ liệu đánh giá cho học kỳ này hoặc giáo viên chưa có lớp được phân công" 
            });
        }

        // Kiểm tra dữ liệu có đầy đủ không
        if (!data[0].semester || !data[0].year || !data[0].class_name || !data[0].faculty_name) {
            console.error("❌ [TEACHER EXCEL PREVIEW] Dữ liệu không đầy đủ:", data[0]);
            return res.status(500).json({ 
                error: "Dữ liệu không đầy đủ",
                message: "Dữ liệu học kỳ hoặc thông tin lớp không đầy đủ. Vui lòng kiểm tra cấu hình hệ thống." 
            });
        }

        return res.json({
            title: `TỔNG HỢP KQRL HK ${data[0].semester} NĂM ${data[0].year} - ${data[0].year + 1}`,
            classInfo: `Lớp: ${data[0].class_name} - Khoa: ${data[0].faculty_name}`,
            columns: ["TT", "Mã SV", "Họ và tên", "Lớp", "Khoa", "Khóa", "TC1", "TC2", "TC3", "TC4", "TC5", "Tổng điểm","Phân loại"],
            rows: data.map((item, index) => ({
                tt: index + 1,
                student_code: item.student_code,
                full_name: item.full_name,
                class_code: item.class_code,
                faculty: item.faculty_name,
                course: item.course,
                tc1: item.tc1 || 0,
                tc2: item.tc2 || 0,
                tc3: item.tc3 || 0,
                tc4: item.tc4 || 0,
                tc5: item.tc5 || 0,
                total_score: item.total_score,
                rank: item.rank
            }))
        });
    } catch (error) {
        console.error("❌ [TEACHER EXCEL PREVIEW] Lỗi:", {
            message: error.message,
            stack: error.stack,
            term_code,
            teacher_id
        });
        res.status(500).json({ 
            error: "Lỗi hệ thống",
            message: "Đã xảy ra lỗi khi tạo báo cáo. Vui lòng thử lại sau.",
            ...(process.env.NODE_ENV === 'development' && { debug: error.message })
        });
    }
};

//GV
export const exportTeacherExcel = async (req, res) => {
    const { term_code, teacher_id } = req.query;
    if (!term_code || !teacher_id) return res.status(400).send("Thiếu dữ liệu đầu vào: term_code hoặc teacher_id");

    try {
        const data = await reportTeacher(term_code, teacher_id);
        
        if (data.length === 0) {
            return res.status(404).send("Không có dữ liệu");
        }

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Báo cáo");

        const border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" }
        };

        const center = { vertical: "middle", horizontal: "center" };

        // Header
        sheet.mergeCells("A1:N1");
        sheet.getCell("A1").value = `TỔNG HỢP KQRL SINH VIÊN HỌC KỲ ${data[0].semester} NĂM HỌC ${data[0].year} - ${data[0].year + 1}`;
        sheet.getCell("A1").font = { size: 14, bold: true };
        sheet.getCell("A1").alignment = center;

        sheet.mergeCells("A2:N3");
        sheet.getCell("A2").value = `Lớp: ${data[0].class_name}  Khoa: ${data[0].faculty_name}`;
        sheet.getCell("A2").alignment = { horizontal: "left" };

        // Column headers
        sheet.getRow(5).values = [
            "TT",
            "Mã SV",
            "Họ và tên",
            "Lớp",
            "Khoa",
            "Khóa",
            "TC1",
            "TC2",
            "TC3",
            "TC4",
            "TC5",
            "Tổng điểm",
            "Phân loại"
        ];

        sheet.columns = [
            { key: "tt", width: 5 },
            { key: "masv", width: 12 },
            { key: "hoten", width: 25 },
            { key: "lop", width: 12 },
            { key: "khoa", width: 20 },
            { key: "khoas", width: 10 },
            { key: "tc1", width: 8 },
            { key: "tc2", width: 8 },
            { key: "tc3", width: 8 },
            { key: "tc4", width: 8 },
            { key: "tc5", width: 8 },
            { key: "tongdiem", width: 12 },
            { key: "phanloai", width: 12 }
        ];

        sheet.getRow(5).font = { bold: true };
        sheet.getRow(5).alignment = center;
        sheet.getRow(5).eachCell(cell => (cell.border = border));

        // Data rows
        data.forEach((item, index) => {
            const row = sheet.addRow([
                index + 1,
                item.student_code,
                item.full_name,
                item.class_code,
                item.faculty_name,
                item.course,
                item.tc1 || 0,
                item.tc2 || 0,
                item.tc3 || 0,
                item.tc4 || 0,
                item.tc5 || 0,
                item.total_score,
                item.rank
            ]);

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
            `attachment; filename=Bao_cao_lop_${data[0].class_code}.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Lỗi exportTeacherExcel:", error);
        res.status(500).send("Lỗi khi tạo file Excel");
    }
};
