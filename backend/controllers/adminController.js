import pool from "../db.js";
import {
  toNum,
  parseGroupId,
  validateGroupIdMaybe,
  pickFallbackGroupId,
  getConfig,
} from "../utils/helpers.js";
import { getSearchClassStudents } from "../models/adminModel.js";
// Giả sử termController.js nằm cùng cấp hoặc bạn cần sửa đường dẫn
// const { getTerms } = require('./termController'); // Tạm comment nếu chưa dùng hoặc gây lỗi

// --- Helpers cho Admin ---
// (Có thể thêm middleware kiểm tra role Admin ở đây hoặc trong routes/admin.js)

// --- Controllers ---

export const getFaculties = async (req, res, next) => {
  const { term } = req.query || {};
  if (!term) return res.status(400).json({ error: "missing_term" });

  try {
    const { rows } = await pool.query(
      `
       SELECT
         f.code AS faculty_code, f.name AS faculty_name,
         COUNT(s.id) AS total_students,
         COUNT(DISTINCT ts.student_id) AS completed,
         COALESCE(ROUND(AVG(ts.total_score) FILTER (WHERE ts.total_score IS NOT NULL)), 0)::numeric(5,2) AS avg_score
       FROM ref.faculty f
       LEFT JOIN ref.class   c ON c.faculty_id = f.id
       LEFT JOIN ref.student s ON s.class_id   = c.id
       LEFT JOIN drl.term_score ts ON ts.student_id = s.id AND ts.term_code = $1
       GROUP BY f.id, f.code, f.name -- Group by f.id
       ORDER BY f.code
     `,
      [term]
    );
    res.json(rows);
  } catch (err) {
    console.error("Admin Get Faculties Error:", err);
    next(err);
  }
};

export const getClasses = async (req, res, next) => {
  const { term, faculty } = req.query || {};
  if (!term) return res.status(400).json({ error: "missing_term" });

  try {
    const params = [term];
    let query = `
       SELECT
         f.code AS faculty_code,
         c.code AS class_code, c.name AS class_name,
         COUNT(s.id) AS total_students,
         COUNT(DISTINCT ts.student_id) AS completed,
         COALESCE(ROUND(AVG(ts.total_score) FILTER (WHERE ts.total_score IS NOT NULL)), 0)::numeric(5,2) AS avg_score
       FROM ref.class c
       JOIN ref.faculty f ON f.id = c.faculty_id
       LEFT JOIN ref.student s ON s.class_id = c.id
       LEFT JOIN drl.term_score ts ON ts.student_id = s.id AND ts.term_code = $1
       WHERE 1=1
    `;

    if (faculty) {
      query += " AND f.code = $2";
      params.push(faculty.trim());
    }

    query += `
       GROUP BY f.code, c.id, c.code, c.name
       ORDER BY f.code, c.code
     `;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error("Admin Get Classes Error:", err);
    next(err);
  }
};

export const getClassStudents = async (req, res, next) => {
  const { class_code, term } = req.query || {};
  if (!class_code || !term)
    return res.status(400).json({ error: "missing_params" });

  try {
    const { rows } = await pool.query(
      `
       SELECT
         s.student_code, s.full_name,
         c.code AS class_code,
         COALESCE(ts.total_score, 0)::int AS total_score -- Lấy từ term_score
       FROM ref.class c
       JOIN ref.student s ON s.class_id = c.id
       LEFT JOIN drl.term_score ts ON ts.student_id = s.id AND ts.term_code = $2
       WHERE c.code = $1
       GROUP BY s.student_code, s.full_name, c.code, ts.total_score -- Thêm ts.total_score vào GROUP BY
       ORDER BY s.student_code
     `,
      [class_code.trim(), term]
    );

    res.json(rows);
  } catch (err) {
    console.error("Admin Get Class Students Error:", err);
    next(err);
  }
};

// --- Group Controllers (CRUD Groups) ---
export const getGroups = async (req, res, next) => {
  const { term } = req.query || {};
  if (!term) return res.status(400).json({ error: "missing_term" });

  const { GROUP_TBL } = getConfig();

  try {
    // 1. Thử lấy các nhóm đã có trong CSDL
    const dbGroupsRes = await pool.query(
      `SELECT
                id, term_code, code, title,
                COALESCE(NULLIF(regexp_replace(code::text, '\\D','','g'),'')::int, NULLIF(regexp_replace(title::text, '\\D','','g'),'')::int, 0) AS group_no
             FROM ${GROUP_TBL}
             WHERE term_code = $1
             ORDER BY group_no NULLS LAST, id`,
      [term]
    );

    let groups = dbGroupsRes.rows;

    // 2. Nếu KHÔNG có nhóm nào trong CSDL -> Tạo danh sách ảo 1-20
    if (groups.length === 0) {
      console.log(
        `No groups found for term ${term}. Returning virtual groups (1-20).`
      );
      const virtualGroups = [];
      for (let i = 1; i <= 20; i++) {
        virtualGroups.push({
          id: null, // Không có ID vì chưa lưu CSDL
          group_no: i,
          code: String(i), // Vẫn cần code để backend xử lý khi lưu tiêu chí
          title: `Nhóm ${i}`,
          // Không có term_code vì đây là ảo
        });
      }
      groups = virtualGroups; // Sử dụng danh sách ảo
    } else {
      // Nếu có nhóm thực tế, xử lý group_no và sắp xếp như trước
      let maxExistingNo = 0;
      groups.forEach((g) => {
        if (!g.group_no || g.group_no <= 0) {
          g.group_no =
            parseInt(String(g.code || g.title || "").replace(/\D/g, "")) || 0;
        }
        if (g.group_no > maxExistingNo) maxExistingNo = g.group_no;
      });
      groups.forEach((g) => {
        if (g.group_no <= 0) {
          maxExistingNo++;
          g.group_no = maxExistingNo;
        }
      });
      groups.sort((a, b) => a.group_no - b.group_no);
    }

    // Chỉ trả về các trường cần thiết cho frontend
    const resultForFrontend = groups.map((g) => ({
      id: g.id, // Sẽ là null cho nhóm ảo
      group_no: g.group_no,
      code: g.code, // Gửi code để backend biết cần tạo nhóm nào
      title: g.title,
    }));
    res.json(resultForFrontend);
  } catch (err) {
    console.error("Admin Get Groups Error:", err);
    next(err);
  }
  // Không cần client.release() vì chỉ dùng pool.query
};

// Tạo Group mới
export const createGroup = async (req, res, next) => {
  // Cần term_code, code, title từ body
  const { term_code, code, title, display_order } = req.body;
  if (!term_code || !code || !title) {
    return res.status(400).json({ error: "missing_group_fields" });
  }
  const { GROUP_TBL } = getConfig();

  try {
    const result = await pool.query(
      `INSERT INTO ${GROUP_TBL} (term_code, code, title, display_order, max_points)
             VALUES ($1, $2, $3, $4, 0)
             RETURNING *`,
      [term_code, code, title, display_order || 99]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      // Lỗi trùng (term_code, code)
      return res
        .status(409)
        .json({ error: "duplicate_group_code", detail: err.detail });
    }
    next(err);
  }
};

// Cập nhật Group
export const updateGroup = async (req, res, next) => {
  const { id } = req.params;
  const { code, title, display_order } = req.body; // Chỉ cho phép sửa 3 trường này
  if (!code || !title) {
    return res.status(400).json({ error: "missing_group_fields" });
  }
  const { GROUP_TBL } = getConfig();

  try {
    const result = await pool.query(
      `UPDATE ${GROUP_TBL}
             SET code = $1, title = $2, display_order = $3
             WHERE id = $4
             RETURNING *`,
      [code, title, display_order || 99, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "group_not_found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      // Lỗi trùng (term_code, code)
      return res
        .status(409)
        .json({ error: "duplicate_group_code_update", detail: err.detail });
    }
    next(err);
  }
};

// Xóa Group
export const deleteGroup = async (req, res, next) => {
  const { id } = req.params;
  const { GROUP_TBL } = getConfig();

  try {
    // Cần kiểm tra xem nhóm này có đang được sử dụng bởi drl.criterion không
    const check = await pool.query(
      "SELECT 1 FROM drl.criterion WHERE group_id = $1 LIMIT 1",
      [id]
    );
    if (check.rowCount > 0) {
      return res
        .status(400)
        .json({
          error: "group_in_use_by_criteria",
          message: "Không thể xóa nhóm đang được tiêu chí sử dụng.",
        });
    }

    const result = await pool.query(`DELETE FROM ${GROUP_TBL} WHERE id = $1`, [
      id,
    ]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "group_not_found_for_delete" });
    }
    res.status(200).json({ ok: true, message: "Nhóm đã được xóa." });
  } catch (err) {
    if (err.code === "23503") {
      // Lỗi FK (dù đã check, nhưng để dự phòng)
      return res
        .status(400)
        .json({ error: "group_in_use", detail: err.detail });
    }
    next(err);
  }
};

// --- Criteria Controllers (CRUD Criteria & Options) ---

// Tạo mới (hoặc Upsert - tùy logic bạn muốn)
export const createOrUpdateCriterion = async (req, res, next) => {
  const {
    term_code,
    code,
    title,
    type,
    max_points,
    display_order,
    group_id,
    group_no,
  } = req.body || {};
  if (!term_code || !code || !title) {
    return res.status(400).json({ error: "missing_body_fields" });
  }
  const _type = ["radio", "text", "auto"].includes(type) ? type : "radio";
  const { GROUP_TBL, HAS_GROUP_ID, GROUP_ID_NOT_NULL } = getConfig();
  let finalGroupId = null;

  if (HAS_GROUP_ID) {
    // 1. Ưu tiên group_id gửi lên (nếu người dùng chọn nhóm đã tồn tại)
    finalGroupId = await validateGroupIdMaybe(group_id);

    // 2. Nếu không có group_id hợp lệ, kiểm tra xem có group_no hoặc code nhóm được gửi không
    //    (Điều này xảy ra khi người dùng chọn nhóm ảo)
    if (finalGroupId == null) {
      // Cố gắng lấy số nhóm từ group_no hoặc code của tiêu chí
      const targetGroupCode = String(group_no || parseGroupId(code) || "");

      if (targetGroupCode) {
        const client = await pool.connect(); // Cần client để đảm bảo tạo và lấy ID
        try {
          await client.query("BEGIN"); // Bắt đầu transaction nhỏ cho việc tạo/lấy group
          const groupTitle = `Nhóm ${targetGroupCode}`; // Title mặc định

          // --- ĐÂY LÀ PHẦN ĐÃ SỬA ---
          // Liệt kê TẤT CẢ cột NOT NULL (trừ id tự tăng)
          const insertGroupQuery = `
                        INSERT INTO ${GROUP_TBL}
                            (term_code, code, title, max_points, display_order)
                        VALUES ($1, $2, $3, $4, $5)
                        ON CONFLICT (term_code, code) DO NOTHING
                        RETURNING id`;

          // Cung cấp giá trị mặc định cho các cột NOT NULL
          const groupOrder = parseInt(targetGroupCode.replace(/\D/g, "")) || 99; // Lấy số từ code làm thứ tự
          const insertParams = [
            term_code, // $1: term_code
            targetGroupCode, // $2: code (ví dụ: '1')
            groupTitle, // $3: title (ví dụ: 'Nhóm 1')
            0, // $4: Giá trị mặc định cho max_points
            groupOrder, // $5: Giá trị mặc định cho display_order
          ];
          // --- HẾT PHẦN SỬA ---

          console.log(
            "[DEBUG AutoGroup] Attempting INSERT group:",
            insertGroupQuery,
            insertParams
          ); // Log kiểm tra
          const createGroupRes = await client.query(
            insertGroupQuery,
            insertParams
          );

          if (createGroupRes.rowCount > 0) {
            // Nếu tạo thành công, lấy ID mới
            finalGroupId = createGroupRes.rows[0].id;
            console.log(
              `Auto-created group ${targetGroupCode} for term ${term_code} with ID: ${finalGroupId}`
            );
          } else {
            // Nếu bị conflict (đã tồn tại), query lại để lấy ID
            const selectGroupRes = await client.query(
              `SELECT id FROM ${GROUP_TBL} WHERE term_code = $1 AND code = $2`,
              [term_code, targetGroupCode]
            );
            if (selectGroupRes.rowCount > 0) {
              finalGroupId = selectGroupRes.rows[0].id;
            } else {
              // Trường hợp hiếm: không tạo được và không tìm thấy -> Ném lỗi
              await client.query("ROLLBACK"); // Hoàn tác transaction group
              throw new Error(
                `Could not find or create group with code ${targetGroupCode} for term ${term_code}`
              );
            }
          }
          await client.query("COMMIT"); // Commit transaction group
        } catch (groupError) {
          await client.query("ROLLBACK"); // Hoàn tác nếu có lỗi
          console.error("Error auto-creating group:", groupError); // LỖI GỐC SẼ HIỆN Ở ĐÂY
          // Quyết định trả lỗi hay tiếp tục mà không có group_id tùy thuộc vào GROUP_ID_NOT_NULL
          if (GROUP_ID_NOT_NULL) {
            // Trả về lỗi 500 mà bạn thấy
            return res
              .status(500)
              .json({
                error: "failed_auto_create_group",
                detail: groupError.message,
              });
          }
          // Nếu group_id nullable, có thể bỏ qua lỗi và để finalGroupId là null
        } finally {
          client.release(); // Luôn giải phóng client
        }
      }
    }

    // 3. Nếu vẫn không có ID và cột group_id bắt buộc NOT NULL -> Lỗi
    if (GROUP_ID_NOT_NULL && finalGroupId == null) {
      return res
        .status(400)
        .json({ error: "cannot_determine_or_create_group_id" });
    }
  }

  // --- Thực hiện INSERT/UPDATE drl.criterion ---
  try {
    const result = await pool.query(
      `
        INSERT INTO drl.criterion(term_code, code, title, type, max_points, display_order, group_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (term_code, code)
        DO UPDATE SET
            title = EXCLUDED.title,
            type = EXCLUDED.type,
            max_points = EXCLUDED.max_points,
            display_order = EXCLUDED.display_order,
            group_id = EXCLUDED.group_id -- Luôn cập nhật group_id
        RETURNING * -- Trả về toàn bộ row đã insert/update
        `,
      [
        term_code.trim(),
        code.trim(),
        title.trim(),
        _type,
        toNum(max_points) || 0,
        toNum(display_order) ?? 999,
        HAS_GROUP_ID ? finalGroupId : null, // Chỉ insert group_id nếu cột tồn tại
      ]
    );
    // Trả về dữ liệu tiêu chí đã lưu và status tương ứng
    res.status(result.command === "INSERT" ? 201 : 200).json(result.rows[0]);
  } catch (err) {
    console.error("Admin Create/Update Criterion Error:", err);
    if (err.code === "23503")
      return res
        .status(400)
        .json({ error: "invalid_group_id_foreign_key", detail: err.detail });
    if (err.code === "23505")
      return res
        .status(409)
        .json({ error: "duplicate_criterion_code", detail: err.detail });
    if (err.code === "23502")
      return res
        .status(400)
        .json({
          error: "missing_required_criterion_field",
          detail: err.detail,
        });
    next(err); // Chuyển lỗi khác
  }
};

// Update theo ID
export const updateCriterion = async (req, res, next) => {
  const { id } = req.params;
  // Lấy term_code hiện tại của criterion để tạo group nếu cần
  let existingTermCode = null;
  try {
    const termRes = await pool.query(
      "SELECT term_code FROM drl.criterion WHERE id = $1",
      [id]
    );
    if (termRes.rowCount > 0) {
      existingTermCode = termRes.rows[0].term_code;
    } else {
      return res.status(404).json({ error: "criterion_not_found_for_update" });
    }
  } catch (fetchErr) {
    return next(fetchErr);
  }

  // Lấy dữ liệu mới từ body, cho phép thiếu term_code khi update
  const {
    term_code = existingTermCode,
    code,
    title,
    type,
    max_points,
    display_order,
    group_id,
    group_no,
    require_hsv_verify,
  } = req.body || {};

  if (!id || !code || !title) {
    return res.status(400).json({ error: "missing_id_or_body_fields" });
  }
  const _type = ["radio", "text", "auto"].includes(type) ? type : "radio";
  const { GROUP_TBL, HAS_GROUP_ID, GROUP_ID_NOT_NULL } = getConfig();
  let finalGroupId = null;

  // Logic tìm/tạo group_id tương tự như createOrUpdateCriterion
  if (HAS_GROUP_ID) {
    finalGroupId = await validateGroupIdMaybe(group_id);
    if (finalGroupId == null) {
      const targetGroupCode = String(group_no || parseGroupId(code) || "");
      if (targetGroupCode) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const groupTitle = `Nhóm ${targetGroupCode}`;

          // --- ĐÂY LÀ PHẦN ĐÃ SỬA ---
          const insertGroupQuery = `
                        INSERT INTO ${GROUP_TBL}
                            (term_code, code, title, max_points, display_order)
                        VALUES ($1, $2, $3, $4, $5)
                        ON CONFLICT (term_code, code) DO NOTHING
                        RETURNING id`;
          const groupOrder = parseInt(targetGroupCode.replace(/\D/g, "")) || 99;
          const insertParams = [
            term_code,
            targetGroupCode,
            groupTitle,
            0,
            groupOrder,
          ];
          // --- HẾT PHẦN SỬA ---

          // console.log(
          //   "[DEBUG AutoGroup] Attempting INSERT group (update context):",
          //   insertGroupQuery,
          //   insertParams
          // );
          const createGroupRes = await client.query(
            insertGroupQuery,
            insertParams
          );

          if (createGroupRes.rowCount > 0) {
            finalGroupId = createGroupRes.rows[0].id;
          } else {
            const selectGroupRes = await client.query(
              `SELECT id FROM ${GROUP_TBL} WHERE term_code = $1 AND code = $2`,
              [term_code, targetGroupCode]
            );
            if (selectGroupRes.rowCount > 0)
              finalGroupId = selectGroupRes.rows[0].id;
            else {
              await client.query("ROLLBACK");
              throw new Error(`Could not find/create group ${targetGroupCode}`);
            }
          }
          await client.query("COMMIT");
        } catch (groupError) {
          await client.query("ROLLBACK");
          console.error("Error auto-creating group during update:", groupError); // LỖI GỐC SẼ HIỆN Ở ĐÂY
          if (GROUP_ID_NOT_NULL)
            return res
              .status(500)
              .json({
                error: "failed_auto_create_group",
                detail: groupError.message,
              });
        } finally {
          client.release();
        }
      }
    }
    if (GROUP_ID_NOT_NULL && finalGroupId == null) {
      return res
        .status(400)
        .json({ error: "cannot_determine_or_create_group_id_for_update" });
    }
  }

  // --- Thực hiện UPDATE drl.criterion ---
  try {
    const params = [
      code.trim(),
      title.trim(),
      _type,
      toNum(max_points) || 0,
      toNum(display_order) ?? 999,
      require_hsv_verify,
    ];
    
    let setClauses =
      "code=$1, title=$2, type=$3, max_points=$4, display_order=$5, require_hsv_verify=$6";
    // Chỉ cập nhật group_id nếu cột tồn tại
    if (HAS_GROUP_ID) {
      setClauses += `, group_id=$${params.length + 1}`;
      params.push(finalGroupId); // Có thể là null nếu nullable
    }
    // Thêm term_code vào SET nếu nó được gửi lên (hiếm khi cần đổi term_code)
    // if (req.body.term_code && req.body.term_code !== existingTermCode) {
    //    setClauses += `, term_code=$${params.length + 1}`;
    //    params.push(req.body.term_code.trim());
    // }

    params.push(id); // id cho WHERE clause

    const result = await pool.query(
      `UPDATE drl.criterion SET ${setClauses} WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (result.rowCount === 0) {
      // Trường hợp này ít xảy ra vì đã kiểm tra ở trên, nhưng vẫn nên có
      return res
        .status(404)
        .json({ error: "criterion_not_found_during_update" });
    }
    res.json(result.rows[0]); // Trả về tiêu chí đã cập nhật
  } catch (err) {
    console.error("Admin Update Criterion Error:", err);
    if (err.code === "23503")
      return res
        .status(400)
        .json({
          error: "invalid_group_id_foreign_key_update",
          detail: err.detail,
        });
    if (err.code === "23505")
      return res
        .status(409)
        .json({ error: "duplicate_criterion_code_update", detail: err.detail });
    if (err.code === "23502")
      return res
        .status(400)
        .json({
          error: "missing_required_criterion_field_update",
          detail: err.detail,
        });
    next(err);
  }
};

export const deleteCriterion = async (req, res, next) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "missing_id" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Xóa các bảng phụ thuộc trước
    await client.query(
      `DELETE FROM drl.self_assessment WHERE criterion_id = $1`,
      [id]
    );
    await client.query(
      `DELETE FROM drl.criterion_option WHERE criterion_id = $1`,
      [id]
    );
    try {
      // Bảng này có thể không tồn tại
      await client.query(
        `DELETE FROM drl.criterion_evidence_map WHERE criterion_id = $1`,
        [id]
      );
    } catch (_) {}

    // Xóa tiêu chí chính
    const result = await client.query(
      `DELETE FROM drl.criterion WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK"); // Hoàn tác nếu không tìm thấy
      return res.status(404).json({ error: "criterion_not_found" });
    }

    await client.query("COMMIT");
    res
      .status(200)
      .json({ ok: true, message: "Criterion deleted successfully" }); // Hoặc 204 No Content
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Admin Delete Criterion Error:", err);
    // Kiểm tra lỗi ràng buộc khóa ngoại nếu có bảng khác chưa xử lý
    if (err.code === "23503")
      return res
        .status(400)
        .json({ error: "criterion_in_use", detail: err.detail });
    next(err);
  } finally {
    client.release();
  }
};

export const updateCriterionOptions = async (req, res, next) => {
  const { id } = req.params;
  const { options } = req.body || {};
  if (!id || !Array.isArray(options)) {
    return res.status(400).json({ error: "missing_id_or_options" });
  }
  const criterion_id = toNum(id);
  if (!criterion_id)
    return res.status(400).json({ error: "invalid_criterion_id" });

  const { OPT_SCORE_COL, OPT_ORDER_COL } = getConfig();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Kiểm tra tiêu chí tồn tại và là loại 'radio'
    const critCheck = await client.query(
      `SELECT type FROM drl.criterion WHERE id = $1`,
      [criterion_id]
    );
    if (critCheck.rowCount === 0) throw new Error("criterion_not_found");
    if (critCheck.rows[0].type !== "radio")
      throw new Error("criterion_not_radio");

    // 2. Bỏ liên kết option_id trong self_assessment trước khi xóa options
    await client.query(
      `UPDATE drl.self_assessment SET option_id = NULL
             WHERE criterion_id = $1 AND option_id IS NOT NULL`,
      [criterion_id]
    );

    // 3. Xóa tất cả option cũ của tiêu chí này
    await client.query(
      `DELETE FROM drl.criterion_option WHERE criterion_id = $1`,
      [criterion_id]
    );

    // 4. Insert các option mới
    const insertedOptions = [];
    if (options.length > 0) {
      const cols = ["criterion_id", "label", OPT_SCORE_COL];
      const valuePlaceholders = ["$1", "$2", "$3"];
      if (OPT_ORDER_COL) {
        cols.push(OPT_ORDER_COL);
        valuePlaceholders.push("$4");
      }

      const queryText = `INSERT INTO drl.criterion_option (${cols.join(
        ", "
      )}) VALUES (${valuePlaceholders.join(", ")}) RETURNING *`;

      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const label = (opt.label || "").trim();
        if (!label) continue; // Bỏ qua option không có label

        const params = [criterion_id, label, toNum(opt.score) || 0];
        if (OPT_ORDER_COL) {
          params.push(toNum(opt.display_order) ?? i + 1);
        }

        const result = await client.query(queryText, params);
        insertedOptions.push(result.rows[0]);
      }
    }

    await client.query("COMMIT");
    res.json({ ok: true, options: insertedOptions });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Admin Update Options Error:", err);
    if (
      err.message === "criterion_not_found" ||
      err.message === "criterion_not_radio"
    ) {
      res.status(404).json({ error: err.message });
    } else {
      next(err);
    }
  } finally {
    client.release();
  }
};

// Lấy danh sách học kỳ KÈM trạng thái mở/khóa đánh giá
export const getTermsWithStatus = async (req, res, next) => {
  // Có thể không cần filter theo term query param ở đây
  try {
    const { rows } = await pool.query(
      `SELECT code, title, year, semester, is_active, is_assessment_open
       FROM ref.term
       ORDER BY year DESC, semester DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("Admin Get Terms With Status Error:", err);
    next(err);
  }
};

// Cập nhật trạng thái mở/khóa đánh giá cho một học kỳ
export const setTermAssessmentStatus = async (req, res, next) => {
  const { termCode } = req.params;
  const { isOpen } = req.body; // Frontend sẽ gửi { isOpen: true } hoặc { isOpen: false }

  if (typeof isOpen !== "boolean") {
    return res.status(400).json({ error: "invalid_is_open_value" });
  }

  try {
    const result = await pool.query(
      "UPDATE ref.term SET is_assessment_open = $1 WHERE code = $2 RETURNING code, is_assessment_open",
      [isOpen, termCode]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "term_not_found" });
    }

    res.json({
      ok: true,
      termCode: result.rows[0].code,
      isAssessmentOpen: result.rows[0].is_assessment_open,
      message: `Đã ${isOpen ? "mở" : "khóa"} đánh giá cho kỳ ${termCode}.`,
    });
  } catch (err) {
    console.error("Admin Set Term Assessment Status Error:", err);
    next(err);
  }
};

export const getAdminTerms = async (req, res, next) => {
  // Thêm is_assessment_open vào SELECT
  try {
    const { sortBy } = req.query; // Ví dụ: sortBy=year_desc,semester_desc
    let orderByClause = "ORDER BY year DESC, semester DESC"; // Mặc định
    // Cần xử lý sortBy an toàn hơn ở đây nếu bạn cho phép nhiều kiểu sort

    const { rows } = await pool.query(
      `SELECT code, title, year, semester, start_date, end_date, is_active, is_assessment_open
             FROM ref.term
             ${orderByClause}`
    );
    res.json(rows);
  } catch (err) {
    console.error("Admin Get Terms Error:", err);
    next(err);
  }
};

export const createAdminTerm = async (req, res, next) => {
  const { code, title, year, semester, start_date, end_date, is_active } =
    req.body;

  // --- Validation cơ bản ---
  if (!code || !title || !year || !semester) {
    return res.status(400).json({ error: "missing_required_term_fields" });
  }
  if (![1, 2, 3].includes(semester)) {
    return res.status(400).json({ error: "invalid_semester_value" });
  }
  // --- Hết Validation ---

  try {
    const result = await pool.query(
      `INSERT INTO ref.term (code, title, year, semester, start_date, end_date, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`, // Trả về toàn bộ term vừa tạo
      [
        code.trim(),
        title.trim(),
        year,
        semester,
        start_date || null, // Gửi null nếu không có
        end_date || null, // Gửi null nếu không có
        is_active !== undefined ? is_active : true, // Mặc định là true
      ]
    );

    res.status(201).json(result.rows[0]); // Trả về term mới với status 201 Created
  } catch (err) {
    console.error("Admin Create Term Error:", err);
    if (err.code === "23505") {
      // Lỗi unique constraint (trùng mã code)
      return res
        .status(409)
        .json({ error: "duplicate_term_code", detail: err.detail });
    }
    next(err); // Chuyển lỗi khác cho error handler
  }
};

export const updateAdminTerm = async (req, res, next) => {
  const { termCode } = req.params; // Lấy mã kỳ từ URL
  // Lấy dữ liệu cần cập nhật từ body, không cho phép cập nhật 'code'
  const {
    title,
    year,
    semester,
    start_date,
    end_date,
    is_active,
    is_assessment_open,
  } = req.body;

  // --- Validation cơ bản ---
  if (!title || !year || !semester) {
    return res
      .status(400)
      .json({ error: "missing_required_term_fields_for_update" });
  }
  if (![1, 2, 3].includes(semester)) {
    return res.status(400).json({ error: "invalid_semester_value" });
  }
  // --- Hết Validation ---

  try {
    const result = await pool.query(
      `UPDATE ref.term
       SET title = $1,
           year = $2,
           semester = $3,
           start_date = $4,
           end_date = $5,
           is_active = $6,
           is_assessment_open = $7
       WHERE code = $8
       RETURNING *`, // Trả về toàn bộ term đã cập nhật
      [
        title.trim(),
        year,
        semester,
        start_date || null,
        end_date || null,
        is_active !== undefined ? is_active : true, // Giữ giá trị cũ nếu không gửi lên? Hoặc mặc định true?
        is_assessment_open !== undefined ? is_assessment_open : true, // Giữ giá trị cũ nếu không gửi?
        termCode, // Mã kỳ để tìm và cập nhật
      ]
    );

    // Kiểm tra xem có dòng nào được cập nhật không
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "term_not_found_for_update" });
    }

    res.status(200).json(result.rows[0]); // Trả về term đã cập nhật
  } catch (err) {
    console.error("Admin Update Term Error:", err);
    // Không nên có lỗi trùng code vì không cho cập nhật code
    next(err); // Chuyển lỗi khác cho error handler
  }
};

// --- THÊM HÀM NÀY VÀO backend/controllers/adminController.js ---

export const deleteAdminTerm = async (req, res, next) => {
  const { termCode } = req.params; // Lấy mã kỳ từ URL

  try {
    // Trước khi xóa, cần đảm bảo không có dữ liệu nào khác tham chiếu đến term này
    // (ví dụ: drl.term_score, drl.criterion, drl.self_assessment)
    // Nếu có ràng buộc khóa ngoại (FOREIGN KEY) với ON DELETE RESTRICT (mặc định),
    // câu lệnh DELETE sẽ báo lỗi nếu có dữ liệu tham chiếu.
    // Nếu là ON DELETE CASCADE, dữ liệu tham chiếu sẽ bị xóa theo (cẩn thận!)
    // --> Cách an toàn nhất là kiểm tra trước khi xóa:
    /*
    const checkUsage = await pool.query(
        `SELECT 1 FROM drl.term_score WHERE term_code = $1 LIMIT 1`,
        [termCode]
    );
    if (checkUsage.rowCount > 0) {
        return res.status(400).json({ error: 'term_in_use_by_scores', message: 'Không thể xóa học kỳ đã có điểm.' });
    }
    // Kiểm tra tương tự với các bảng khác nếu cần...
    */

    const result = await pool.query(`DELETE FROM ref.term WHERE code = $1`, [
      termCode,
    ]);

    // Kiểm tra xem có dòng nào bị xóa không
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "term_not_found_for_delete" });
    }

    res
      .status(200)
      .json({ ok: true, message: `Học kỳ ${termCode} đã được xóa.` }); // Hoặc trả về 204 No Content
  } catch (err) {
    console.error("Admin Delete Term Error:", err);
    if (err.code === "23503") {
      // Lỗi Foreign Key Violation
      return res.status(400).json({
        error: "term_in_use",
        message:
          "Không thể xóa học kỳ vì đang được sử dụng bởi dữ liệu khác (ví dụ: điểm, tiêu chí).",
        detail: err.detail,
      });
    }
    next(err); // Chuyển lỗi khác cho error handler
  }
};

// --- THÊM HÀM MỚI ĐỂ SAO CHÉP TIÊU CHÍ ---
export const copyCriteriaFromTerm = async (req, res, next) => {
  const { sourceTermCode, targetTermCode } = req.body;
  // Kiểm tra đầu vào cơ bản
  if (!sourceTermCode || !targetTermCode) {
    return res.status(400).json({ error: "missing_source_or_target_term" });
  }
  if (sourceTermCode === targetTermCode) {
    return res.status(400).json({ error: "source_and_target_cannot_be_same" });
  }

  // Lấy cấu hình CSDL
  const {
    GROUP_TBL,
    OPT_SCORE_COL,
    OPT_ORDER_COL,
    HAS_GROUP_ID,
    GROUP_ID_NOT_NULL,
  } = getConfig();
  console.log("[DEBUG CopyCriteria] Config:", {
    GROUP_TBL,
    OPT_SCORE_COL,
    OPT_ORDER_COL,
    HAS_GROUP_ID,
    GROUP_ID_NOT_NULL,
  });
  // Dừng sớm nếu tên bảng group không hợp lệ
  if (!GROUP_TBL) {
    console.error(
      "CRITICAL ERROR in copyCriteriaFromTerm: GROUP_TBL is undefined or null!"
    );
    return next(
      new Error(
        "Internal server configuration error: Group table name is missing."
      )
    );
  }

  const client = await pool.connect(); // Lấy một kết nối từ pool

  try {
    await client.query("BEGIN"); // Bắt đầu transaction chính

    // 1. Kiểm tra xem kỳ đích đã có tiêu chí chưa
    const checkExisting = await client.query(
      "SELECT 1 FROM drl.criterion WHERE term_code = $1 LIMIT 1",
      [targetTermCode]
    );
    if (checkExisting.rowCount > 0) {
      await client.query("ROLLBACK"); // Hoàn tác transaction
      return res
        .status(409)
        .json({
          error: "target_term_already_has_criteria",
          message: `Kỳ ${targetTermCode} đã có tiêu chí. Không thể sao chép.`,
        });
    }

    // 2. Lấy tất cả tiêu chí, thông tin nhóm cũ, và các options từ kỳ nguồn
    const sourceCriteriaQuery = `
            SELECT
                c.*,
                COALESCE(g.code, '') AS group_code,
                COALESCE(g.title, '') AS group_title,
                COALESCE((
                    SELECT json_agg(o ORDER BY ${
                      OPT_ORDER_COL ? `o.${OPT_ORDER_COL}` : "o.id"
                    })
                    FROM drl.criterion_option o
                    WHERE o.criterion_id = c.id
                ), '[]'::json) AS options
            FROM drl.criterion c
            LEFT JOIN ${GROUP_TBL} g ON g.id = c.group_id
            WHERE c.term_code = $1
            ORDER BY c.id`; // Sắp xếp để đảm bảo thứ tự nhất quán
    console.log("[DEBUG CopyCriteria] Getting source criteria...");
    const sourceCriteriaRes = await client.query(sourceCriteriaQuery, [
      sourceTermCode,
    ]);
    const sourceCriteria = sourceCriteriaRes.rows;
    console.log(
      `[DEBUG CopyCriteria] Found ${sourceCriteria.length} criteria in source term ${sourceTermCode}.`
    );
    // Kiểm tra nếu kỳ nguồn không có tiêu chí
    if (sourceCriteria.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({
          error: "no_criteria_in_source_term",
          message: `Kỳ ${sourceTermCode} không có tiêu chí nào để sao chép.`,
        });
    }

    const groupMap = new Map(); // Map lưu trữ: mã_nhóm_cũ -> id_nhóm_mới_ở_kỳ_đích
    let copiedCount = 0; // Đếm số tiêu chí sao chép thành công
    let skippedCount = 0; // Đếm số tiêu chí bị bỏ qua

    // 3. Lặp qua từng tiêu chí nguồn
    for (const oldCrit of sourceCriteria) {
      console.log(
        `\n[DEBUG CopyCriteria] Processing criterion ID ${oldCrit.id}, Code: ${oldCrit.code}, Source Group Code: '${oldCrit.group_code}', Source Group Title: '${oldCrit.group_title}'`
      );
      let newGroupId = null; // ID của nhóm trong kỳ đích

      // 4. Xử lý ID nhóm mới (chỉ khi cần thiết)
      if (HAS_GROUP_ID && oldCrit.group_code) {
        // Chỉ xử lý nếu bảng criterion có cột group_id và tiêu chí cũ có mã nhóm
        console.log(
          `[DEBUG CopyCriteria] Group processing needed. Source Group Code: ${oldCrit.group_code}`
        );
        // Kiểm tra xem đã xử lý mã nhóm này chưa
        if (groupMap.has(oldCrit.group_code)) {
          newGroupId = groupMap.get(oldCrit.group_code);
          console.log(
            `[DEBUG CopyCriteria] Found existing mapped Group ID for code ${oldCrit.group_code}: ${newGroupId}`
          );
        } else {
          // Nếu chưa, thử tìm hoặc tạo nhóm mới trong kỳ đích
          const groupTitle =
            oldCrit.group_title || `Nhóm ${oldCrit.group_code}`; // Lấy title cũ hoặc tạo title mặc định
          console.log(
            `[DEBUG CopyCriteria] Group ID not mapped. Trying to find/create group for code ${oldCrit.group_code}, title "${groupTitle}" in target term ${targetTermCode}`
          );

          let foundOrCreatedId = null;
          try {
            // Sử dụng SAVEPOINT để cô lập việc tạo/tìm nhóm
            await client.query("SAVEPOINT find_create_group");

            // --- ĐÂY LÀ PHẦN ĐÃ SỬA ---
            // Liệt kê TẤT CẢ cột NOT NULL (trừ id tự tăng)
            const insertGroupQuery = `
                            INSERT INTO ${GROUP_TBL}
                                (term_code, code, title, max_points, display_order)
                            VALUES ($1, $2, $3, $4, $5)
                            ON CONFLICT (term_code, code) DO NOTHING
                            RETURNING id`;

            // Cung cấp giá trị mặc định cho các cột NOT NULL
            const groupOrder =
              parseInt(String(oldCrit.group_code || "").replace(/\D/g, "")) ||
              99; // Lấy số từ code làm thứ tự
            const insertParams = [
              targetTermCode, // $1: term_code
              oldCrit.group_code, // $2: code (ví dụ: '1')
              groupTitle, // $3: title (ví dụ: 'Nhóm 1')
              0, // $4: Giá trị mặc định cho max_points
              groupOrder, // $5: Giá trị mặc định cho display_order
            ];
            // --- HẾT PHẦN SỬA ---

            console.log(
              "[DEBUG CopyCriteria] Attempting INSERT group:",
              insertGroupQuery,
              insertParams
            ); // Log kiểm tra
            const groupRes = await client.query(insertGroupQuery, insertParams); // Thực thi INSERT

            if (groupRes.rowCount > 0) {
              // Nếu INSERT thành công (không bị conflict)
              foundOrCreatedId = groupRes.rows[0].id;
              console.log(
                `[DEBUG CopyCriteria] Successfully INSERTED new group. New Group ID: ${foundOrCreatedId}`
              );
            } else {
              // Nếu INSERT bị conflict (rowCount=0) -> nhóm đã tồn tại
              console.log(
                `[DEBUG CopyCriteria] Group likely exists. Attempting SELECT.`
              );
              const selectGroupQuery = `SELECT id FROM ${GROUP_TBL} WHERE term_code = $1 AND code = $2`;
              console.log(
                "[DEBUG CopyCriteria] Selecting existing group:",
                selectGroupQuery,
                [targetTermCode, oldCrit.group_code]
              );
              const selectRes = await client.query(selectGroupQuery, [
                targetTermCode,
                oldCrit.group_code,
              ]); // Query lại để lấy ID

              if (selectRes.rowCount > 0) {
                // Nếu tìm thấy
                foundOrCreatedId = selectRes.rows[0].id;
                console.log(
                  `[DEBUG CopyCriteria] Successfully SELECTED existing group. Existing Group ID: ${foundOrCreatedId}`
                );
              } else {
                // Trường hợp hiếm: Không INSERT được và cũng không SELECT được
                console.error(
                  `[DEBUG CopyCriteria] CRITICAL: Failed to INSERT and SELECT group ${oldCrit.group_code} for term ${targetTermCode}.`
                );
                await client.query("ROLLBACK TO SAVEPOINT find_create_group"); // Hoàn tác SAVEPOINT
                // Giữ foundOrCreatedId là null
              }
            }
            // Nếu tìm hoặc tạo thành công, giải phóng SAVEPOINT
            if (foundOrCreatedId) {
              await client.query("RELEASE SAVEPOINT find_create_group");
            }
          } catch (groupError) {
            // Nếu có lỗi trong quá trình tạo/tìm nhóm
            console.error(
              `[DEBUG CopyCriteria] Error during find/create group ${oldCrit.group_code}:`,
              groupError
            );
            await client.query("ROLLBACK TO SAVEPOINT find_create_group"); // Hoàn tác SAVEPOINT
            // Giữ foundOrCreatedId là null
          }

          // Gán ID tìm/tạo được cho newGroupId và cập nhật map
          if (foundOrCreatedId) {
            newGroupId = foundOrCreatedId;
            groupMap.set(oldCrit.group_code, newGroupId); // Lưu vào map để tái sử dụng
            console.log(
              `[DEBUG CopyCriteria] Mapped source group code ${oldCrit.group_code} to new Group ID ${newGroupId}`
            );
          } else {
            console.warn(
              `[DEBUG CopyCriteria] Failed to find or create group for code ${oldCrit.group_code}. newGroupId remains null.`
            );
          }
        } // Kết thúc else (tìm/tạo nhóm mới)
      } else if (HAS_GROUP_ID) {
        // Trường hợp bảng có cột group_id nhưng tiêu chí nguồn không có group_code
        console.log(
          `[DEBUG CopyCriteria] No group processing needed (Source Group Code is missing?). oldCrit.group_code: '${oldCrit.group_code}'`
        );
      } // Kết thúc xử lý group

      // 5. Kiểm tra group_id trước khi INSERT tiêu chí
      // Nếu cột group_id yêu cầu NOT NULL mà không xác định được newGroupId -> Bỏ qua
      if (
        HAS_GROUP_ID &&
        GROUP_ID_NOT_NULL &&
        newGroupId === null &&
        oldCrit.group_code
      ) {
        console.warn(
          `---> SKIPPING criterion ID ${oldCrit.id} (Code: ${oldCrit.code}) because required Group ID could not be determined for source group code '${oldCrit.group_code}'.`
        );
        skippedCount++; // Tăng biến đếm bỏ qua
        continue; // Chuyển sang tiêu chí tiếp theo trong vòng lặp
      } else if (HAS_GROUP_ID && newGroupId === null && oldCrit.group_code) {
        // Ghi log nếu group_id cho phép NULL nhưng không tìm/tạo được group
        console.warn(
          `---> Proceeding to insert criterion ID ${oldCrit.id} (Code: ${oldCrit.code}) with NULL group_id because column is nullable, even though group processing failed for source code '${oldCrit.group_code}'.`
        );
      } else if (HAS_GROUP_ID && newGroupId === null && !oldCrit.group_code) {
        // Ghi log nếu group_id cho phép NULL và tiêu chí nguồn không có group_code
        console.log(
          `---> Proceeding to insert criterion ID ${oldCrit.id} (Code: ${oldCrit.code}) with NULL group_id (source had no group code).`
        );
      }

      // 6. Chèn (INSERT) tiêu chí mới vào kỳ đích
      try {
        // Câu lệnh INSERT tiêu chí
        const insertCritQuery = `
                    INSERT INTO drl.criterion
                        (term_code, group_id, code, title, type, max_points, calc_method, display_order)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING id`; // Trả về ID của tiêu chí mới
        // Tham số cho câu lệnh INSERT
        const critParams = [
          targetTermCode,
          newGroupId, // ID nhóm mới (có thể là null nếu cột cho phép)
          oldCrit.code,
          oldCrit.title,
          oldCrit.type,
          oldCrit.max_points,
          oldCrit.calc_method,
          oldCrit.display_order,
        ];
        console.log(
          "[DEBUG CopyCriteria] Inserting criterion:",
          insertCritQuery,
          critParams
        );
        // Thực thi INSERT
        const newCritRes = await client.query(insertCritQuery, critParams);
        const newCriterionId = newCritRes.rows[0].id; // Lấy ID của tiêu chí mới
        console.log(
          `[DEBUG CopyCriteria] Successfully inserted criterion. New Criterion ID: ${newCriterionId}`
        );
        copiedCount++; // Tăng biến đếm thành công

        // 7. Chèn (INSERT) các lựa chọn (options) cho tiêu chí mới (nếu có)
        if (oldCrit.options && oldCrit.options.length > 0) {
          console.log(
            `[DEBUG CopyCriteria] Inserting ${oldCrit.options.length} options for new criterion ID ${newCriterionId}`
          );
          // Xác định tên cột điểm và thứ tự từ config
          const optCols = ["criterion_id", "label", OPT_SCORE_COL];
          const optValuePlaceholders = ["$1", "$2", "$3"];
          if (OPT_ORDER_COL) {
            // Chỉ thêm cột thứ tự nếu nó tồn tại
            optCols.push(OPT_ORDER_COL);
            optValuePlaceholders.push("$4");
          }
          // Tạo câu lệnh INSERT option mẫu
          const optQuery = `INSERT INTO drl.criterion_option (${optCols.join(
            ", "
          )}) VALUES (${optValuePlaceholders.join(", ")})`;
          // Chỉ log câu lệnh mẫu 1 lần
          if (copiedCount === 1) {
            console.log(
              "[DEBUG CopyCriteria] Option insert query template:",
              optQuery
            );
          }

          // Lặp qua từng option cũ để insert option mới
          for (const oldOpt of oldCrit.options) {
            // Tạo mảng tham số cho option
            const optParams = [
              newCriterionId, // ID của tiêu chí mới
              oldOpt.label,
              // Lấy điểm từ tên cột đúng (OPT_SCORE_COL), fallback về 'score', mặc định là 0
              oldOpt[OPT_SCORE_COL] ?? oldOpt.score ?? 0,
            ];
            // Thêm tham số thứ tự nếu cần
            if (OPT_ORDER_COL) {
              // Lấy thứ tự từ tên cột đúng (OPT_ORDER_COL), fallback về 'display_order', mặc định là 99
              optParams.push(
                oldOpt[OPT_ORDER_COL] ?? oldOpt.display_order ?? 99
              );
            }
            // Thực thi INSERT option
            await client.query(optQuery, optParams);
          }
          console.log(
            `[DEBUG CopyCriteria] Finished inserting options for criterion ID ${newCriterionId}.`
          );
        } else {
          console.log(
            `[DEBUG CopyCriteria] No options to insert for criterion ID ${oldCrit.id}.`
          );
        }
      } catch (critInsertErr) {
        // Nếu có lỗi khi INSERT tiêu chí hoặc options
        console.error(
          `---> ERROR inserting criterion ID ${oldCrit.id} (Code: ${oldCrit.code}) or its options:`,
          critInsertErr
        );
        // Ném lỗi ra ngoài để rollback transaction chính
        throw critInsertErr;
      }
    } // Kết thúc vòng lặp for (lặp qua từng tiêu chí nguồn)

    console.log("[DEBUG CopyCriteria] Committing main transaction.");
    await client.query("COMMIT"); // Lưu tất cả thay đổi vào CSDL

    // Tạo thông báo kết quả
    let message = `Đã sao chép ${copiedCount} tiêu chí từ kỳ ${sourceTermCode} sang ${targetTermCode}.`;
    if (skippedCount > 0) {
      // Thêm thông tin nếu có tiêu chí bị bỏ qua
      message += ` Đã bỏ qua ${skippedCount} tiêu chí do không thể xử lý nhóm.`;
    }
    // Trả về kết quả thành công
    res.json({ ok: true, copiedCount, skippedCount, message });
  } catch (err) {
    // Nếu có bất kỳ lỗi nào trong transaction chính
    console.error(
      "[DEBUG CopyCriteria] Rolling back main transaction due to error:",
      err
    );
    await client.query("ROLLBACK"); // Hoàn tác tất cả thay đổi
    console.error("Admin Copy Criteria Error:", err);
    // Ghi log thêm thông tin lỗi CSDL nếu có
    if (err.code) {
      // Check if it's a PostgreSQL error object
      console.error("--- Failing Query Hint ---");
      console.error("Error Code:", err.code);
      console.error("Error Detail:", err.detail);
      console.error("Error Constraint:", err.constraint);
      console.error("------------------------");
    }
    // Chuyển lỗi cho middleware xử lý lỗi chung
    next(err);
  } finally {
    // Luôn thực hiện dù thành công hay thất bại
    console.log("[DEBUG CopyCriteria] Releasing client.");
    client.release(); // Trả kết nối về pool
  }
};

export const searchClass = async (req, res) => {
  const student = req.query;
  console.log("Search query received:", student);
  if (!student || student.length === 0) {
    return res.status(400).json({ error: "missing_search_query" });
  }
  try {
    const search = await getSearchClassStudents(student);
    res.json(search);
  } catch (err) {
    res
      .status(500)
      .json({ error: "internal_server_error", detail: err.message });
  }
};

// --- HẾT THAY THẾ ---
