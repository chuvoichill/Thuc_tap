# Phân Tích Luồng Xử Lý HSV - Admin Criteria

## 📋 Tổng Quan

Phân tích luồng xử lý giữa **HSV (Hội Sinh Viên)** và **Admin Quản Lý Tiêu Chí** liên quan đến checkbox **"Tiêu chí cần hội sinh viên xác nhận"** (`require_hsv_verify`).

---

## 🔍 Luồng Hiện Tại (AS-IS)

### 1. **Admin Quản Lý Tiêu Chí**

#### 1.1. Tạo/Cập nhật tiêu chí
```
Admin → AdminCriteriaPage.jsx
  ↓
  Checkbox "Tiêu chí cần hội sinh viên xác nhận"
  ↓
  POST/PUT /api/admin/criteria
  ↓
  adminController.js (createOrUpdateCriterion/updateCriterion)
  ↓
  criteriaModel.js (upsertCriterion/updateCriterionById)
  ↓
  Database: drl.criterion.require_hsv_verify = TRUE/FALSE
```

**File liên quan:**
- `frontend/src/pages/admin/AdminCriteriaPage.jsx`
- `backend/controllers/adminController.js` (lines 177-371)
- `backend/models/adminModel/criteriaModel.js` (lines 96-177)

#### 1.2. Database Schema
```sql
CREATE TABLE drl.criterion (
  id SERIAL PRIMARY KEY,
  term_code VARCHAR,
  code VARCHAR,
  title VARCHAR,
  type VARCHAR, -- 'radio', 'text', 'auto'
  max_points INT,
  display_order INT,
  group_id INT,
  require_hsv_verify BOOLEAN DEFAULT FALSE, -- ⚠️ Cột quan trọng
  ...
);
```

---

### 2. **Sinh Viên Tự Đánh Giá**

#### 2.1. Luồng tự đánh giá
```
Student → SelfAssessmentPage.jsx
  ↓
  Load criteria: GET /api/drl/criteria?term=...
  ↓
  drlModel.js → getCriteria()
  ↓
  Return: [
    {
      id: 1,
      code: "1.1",
      title: "...",
      require_hsv_verify: false,
      type: "radio",
      options: [...]
    },
    {
      id: 10,
      code: "2.1",
      title: "Tham gia hoạt động Đoàn - HSV",
      require_hsv_verify: true, // ⚠️ Tiêu chí cần HSV xác nhận
      type: "text",
      max_points: 10
    }
  ]
```

#### 2.2. Submit đánh giá
```
Student fills form
  ↓
  POST /api/drl/submit
  ↓
  drlModel.js → postSelfAssessment()
  ↓
  Logic xử lý:
  
  // ⚠️ VẤN ĐỀ 1: Logic kiểm tra require_hsv_verify SAI
  const criteriaText = await pool.query(
    `select id from drl.criterion 
     where term_code = $1 and require_hsv_verify = true`,
    [term_code]
  );
  const criterionID = criteriaText.rows[0]?.id; // ❌ Chỉ lấy 1 criterion
  
  for (const it of items) {
    const isTextCriterion = criterionID.includes(it.criterion_id); // ❌ SAI LOGIC
    
    if (isTextCriterion) {
      it.score = 0; // ✅ Đúng: Set điểm = 0 cho tiêu chí cần HSV xác nhận
    }
    
    // Insert vào drl.self_assessment
    await pool.query(`
      INSERT INTO drl.self_assessment 
      (student_id, term_code, criterion_id, option_id, text_value, self_score, ...)
      VALUES ($1, $2, $3, $4, $5, $6, ...)
      ON CONFLICT (student_id, term_code, criterion_id)
      DO UPDATE SET ...
    `, [student_id, term_code, it.criterion_id, it.option_id, it.text_value, it.score]);
  }
  
  // ⚠️ VẤN ĐỀ 2: Tính tổng điểm SAI
  const sumPoint = items.reduce((sum, x) => sum + (x.score || 0), 0);
  // ❌ Điểm tổng BỊ TÍNH SAI vì bao gồm cả tiêu chí chưa được HSV xác nhận
```

**File:** `backend/models/drlModel.js` (lines 48-88)

---

### 3. **HSV Xác Nhận**

#### 3.1. HSV xem danh sách sinh viên
```
HSV → ViewHSVClassesPage.jsx
  ↓
  GET /api/hsv/classes?term=...
  ↓
  hsvController.js → getListClass()
  ↓
  hsvModel.js → getClass()
  ↓
  Return: Danh sách lớp
  
HSV chọn lớp → HSVStudentList.jsx
  ↓
  GET /api/hsv/students?class_code=...&term=...
  ↓
  hsvController.js → getListStudents()
  ↓
  hsvModel.js → getStudents()
  ↓
  Query:
  
  SELECT s.student_code, s.full_name,
         ctn.code AS criterion_code,
         sa.self_score,
         sa.text_value, 
         sa.is_hsv_verified, 
         sa.hsv_note
  FROM ref.student s 
  JOIN ref.class c ON s.class_id = c.id
  LEFT JOIN drl.criterion ctn 
    ON ctn.term_code = $2 
    AND ctn.require_hsv_verify = TRUE -- ✅ Chỉ lấy tiêu chí cần xác nhận
  LEFT JOIN drl.self_assessment sa 
    ON sa.student_id = s.id 
    AND sa.term_code = $2 
    AND sa.criterion_id = ctn.id
  WHERE c.code = $1
  ORDER BY c.code, s.student_code
  
Return: [
  {
    student_code: "2021001",
    full_name: "Nguyễn Văn A",
    criterion_code: "2.1",
    self_score: 0, // Điểm ban đầu = 0
    text_value: "Tôi tham gia CLB Lập Trình",
    is_hsv_verified: false, // Chưa xác nhận
    hsv_note: null
  }
]
```

#### 3.2. HSV xác nhận
```
HSV → HSVStudentRow.jsx
  ↓
  Checkbox "Tham gia" (isChecked)
  Input "Ghi chú" (note)
  Click "Xác nhận"
  ↓
  POST /api/hsv/confirm
  Body: {
    student_code: "2021001",
    term_code: "2026HK1",
    criterion_code: "2.1",
    participated: true, // Checkbox checked
    note: "Đã xác nhận tham gia"
  }
  ↓
  hsvController.js → postConfirmAssessment()
  ↓
  hsvModel.js → postConfirm()
  ↓
  Logic:
  
  1. Lấy student_id từ student_code
  2. Lấy criterion_id và max_points từ criterion_code
  3. Tính điểm:
     const score = participated ? max_points : 0;
     // Nếu checkbox checked → điểm = max_points (ví dụ: 10)
     // Nếu checkbox unchecked → điểm = 0
  
  4. Lấy text_value hiện tại (nội dung SV đã gửi)
  
  5. INSERT hoặc UPDATE vào drl.self_assessment:
     INSERT INTO drl.self_assessment(
       student_id, term_code, criterion_id, 
       text_value, self_score,
       is_hsv_verified, hsv_note, hsv_verified_by, hsv_verified_at
     )
     VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7, now())
     ON CONFLICT (student_id, term_code, criterion_id)
     DO UPDATE SET
       text_value = COALESCE($4, drl.self_assessment.text_value),
       self_score = EXCLUDED.self_score, -- ✅ Cập nhật điểm
       is_hsv_verified = TRUE,
       hsv_note = EXCLUDED.hsv_note,
       hsv_verified_by = EXCLUDED.hsv_verified_by,
       hsv_verified_at = now()
  
  6. Tính lại tổng điểm (putTotal_Score):
     SELECT coalesce(sum(self_score), 0) as total_score 
     FROM drl.self_assessment 
     WHERE student_id = $1 AND term_code = $2
     
     ↓
     
     INSERT INTO drl.term_score (student_id, term_code, total_score, rank)
     VALUES ($1, $2, $3, drl.rank_by_score($3))
     ON CONFLICT (student_id, term_code)
     DO UPDATE SET total_score = $3, rank = EXCLUDED.rank
```

**File:** `backend/models/hsvModel.js` (lines 62-114)

---

## ❌ Các Vấn Đề Phát Hiện

### **Vấn đề 1: Logic kiểm tra `require_hsv_verify` SAI**

**File:** `backend/models/drlModel.js` (lines 55-59)

```javascript
// ❌ CODE HIỆN TẠI (SAI)
const criteriaText = await pool.query(
  `select id from drl.criterion 
   where term_code = $1 and require_hsv_verify = true`,
  [term_code]
);

const criterionID = criteriaText.rows[0]?.id; 
// ❌ Chỉ lấy 1 criterion đầu tiên, nếu có nhiều tiêu chí cần HSV xác nhận thì SAI

for (const it of items) {
  const isTextCriterion = criterionID.includes(it.criterion_id);
  // ❌ SAI LOGIC: criterionID là NUMBER, không phải ARRAY
  // ❌ Hàm includes() luôn return FALSE
  
  if (isTextCriterion) {
    it.score = 0;
  }
  // ...
}
```

**Hậu quả:**
- Nếu có nhiều tiêu chí `require_hsv_verify = TRUE` (ví dụ: 2.1, 2.2, 2.3), chỉ tiêu chí đầu tiên được xử lý
- Logic `criterionID.includes()` luôn FALSE vì `criterionID` là số, không phải mảng
- Điểm của các tiêu chí cần HSV xác nhận KHÔNG được set về 0 khi sinh viên tự đánh giá

---

### **Vấn đề 2: Tính tổng điểm SAI khi sinh viên tự đánh giá**

**File:** `backend/models/drlModel.js` (line 90)

```javascript
// ❌ CODE HIỆN TẠI (SAI)
const sumPoint = items.reduce((sum, x) => sum + (x.score || 0), 0);
// ❌ Bao gồm cả điểm của các tiêu chí chưa được HSV xác nhận
// ❌ Nếu Vấn đề 1 không được fix, điểm tổng sẽ TÍNH SAI
```

**Ví dụ:**
```javascript
// Sinh viên tự đánh giá:
items = [
  { criterion_id: 1, score: 25 },  // Tiêu chí 1.1
  { criterion_id: 2, score: 6 },   // Tiêu chí 1.2
  { criterion_id: 10, score: 10 }, // ❌ Tiêu chí 2.1 (require_hsv_verify = TRUE)
];

// Tổng điểm tính được: 25 + 6 + 10 = 41 ❌ SAI
// Tổng điểm đúng phải là: 25 + 6 + 0 = 31 (vì tiêu chí 2.1 chưa được HSV xác nhận)
```

---

### **Vấn đề 3: Không có validation khi Admin thay đổi `require_hsv_verify`**

**File:** `backend/controllers/adminController.js`

**Kịch bản:**
1. Admin tạo tiêu chí "2.1" với `require_hsv_verify = TRUE`
2. Sinh viên tự đánh giá, điểm tiêu chí 2.1 = 0 (chờ HSV xác nhận)
3. HSV xác nhận, điểm tiêu chí 2.1 = 10
4. **Admin đổi `require_hsv_verify = FALSE`** (checkbox unchecked)
5. ⚠️ Điểm sinh viên bị SAI vì điểm đã được HSV xác nhận nhưng tiêu chí không còn yêu cầu HSV

**Vấn đề:**
- Không có logic kiểm tra khi Admin thay đổi `require_hsv_verify` từ TRUE → FALSE
- Không tự động recalculate điểm của sinh viên
- Dữ liệu trong `drl.self_assessment` không được cập nhật

---

### **Vấn đề 4: Race Condition khi HSV xác nhận đồng thời**

**File:** `backend/models/hsvModel.js` (lines 80-96)

```javascript
// ❌ Không có locking mechanism
await pool.query(
  `INSERT INTO drl.self_assessment(...)
   VALUES (...)
   ON CONFLICT (student_id, term_code, criterion_id)
   DO UPDATE SET self_score = EXCLUDED.self_score, ...`
);

// Sau đó tính lại tổng điểm
await putTotal_Score(studentID, term_code);
```

**Kịch bản:**
1. HSV 1 xác nhận sinh viên A (tiêu chí 2.1) → điểm = 10
2. HSV 2 xác nhận sinh viên A (tiêu chí 2.1) → điểm = 0 (đồng thời)
3. ⚠️ Race condition: Tổng điểm có thể bị tính SAI

---

### **Vấn đề 5: UI không hiển thị status của tiêu chí cần HSV xác nhận**

**File:** `frontend/src/components/drl/AssessmentForm.jsx`

**Vấn đề:**
- Khi sinh viên tự đánh giá, UI không hiển thị rõ tiêu chí nào cần HSV xác nhận
- Sinh viên có thể nhầm lẫn về điểm tổng (vì điểm tiêu chí cần HSV xác nhận luôn = 0)

**Ví dụ:**
```
Tiêu chí 2.1: Tham gia hoạt động Đoàn - HSV
[ ] Tham gia  [Input: Ghi chú]
Điểm: 0

❌ Không có text giải thích: "Điểm sẽ được HSV xác nhận sau"
```

---

### **Vấn đề 6: Không có log/audit trail**

**Vấn đề:**
- Không lưu lịch sử thay đổi khi HSV cập nhật nhiều lần
- Không biết HSV nào đã xác nhận lần cuối
- Không có timestamp cho các lần xác nhận trước

**Table hiện tại:**
```sql
drl.self_assessment (
  ...
  is_hsv_verified BOOLEAN,
  hsv_note TEXT,
  hsv_verified_by VARCHAR, -- ✅ Có lưu username
  hsv_verified_at TIMESTAMP, -- ✅ Có lưu timestamp
  -- ❌ Không có bảng audit trail riêng
)
```

---

## ✅ Giải Pháp Đề Xuất

### **Giải pháp 1: Fix Logic kiểm tra `require_hsv_verify`**

**File:** `backend/models/drlModel.js`

```javascript
// ✅ CODE MỚI (ĐÚNG)
export const postSelfAssessment = async (student_code, term_code, items) => {
  const studentID = await pool.query(
    "select id from ref.student where student_code = $1",
    [student_code]
  );

  if (studentID.rowCount === 0) {
    throw new Error("Student_404");
  }

  const student_id = studentID.rows[0].id;

  // ✅ FIX 1: Lấy TẤT CẢ criterion_id của các tiêu chí cần HSV xác nhận
  const criteriaRequireHSV = await pool.query(
    `SELECT id FROM drl.criterion 
     WHERE term_code = $1 AND require_hsv_verify = TRUE`,
    [term_code]
  );

  // ✅ Tạo Set để kiểm tra nhanh
  const hsvRequiredIds = new Set(
    criteriaRequireHSV.rows.map(row => row.id)
  );

  for (const it of items) {
    // ✅ FIX 2: Kiểm tra criterion_id có trong Set không
    const requiresHSV = hsvRequiredIds.has(it.criterion_id);

    if (requiresHSV) {
      // ✅ Tiêu chí cần HSV xác nhận → Set điểm = 0
      it.score = 0;
    }

    // Lưu vào self_assessment
    await pool.query(
      `INSERT INTO drl.self_assessment 
       (student_id, term_code, criterion_id, option_id, text_value, self_score, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (student_id, term_code, criterion_id)
       DO UPDATE SET 
         option_id = EXCLUDED.option_id,
         text_value = EXCLUDED.text_value,
         self_score = EXCLUDED.self_score,
         updated_at = now()`,
      [
        student_id,
        term_code,
        it.criterion_id,
        it.option_id || null,
        it.text_value || null,
        it.score || 0
      ]
    );
  }

  // ✅ FIX 3: Tính tổng điểm chính xác (KHÔNG bao gồm tiêu chí chưa HSV xác nhận)
  const sumPoint = items
    .filter(x => !hsvRequiredIds.has(x.criterion_id)) // Loại bỏ tiêu chí cần HSV
    .reduce((sum, x) => sum + (x.score || 0), 0);

  await pool.query(
    `INSERT INTO drl.term_score (student_id, term_code, total_score, updated_at, rank)
     VALUES ($1, $2, $3, now(), drl.rank_by_score($3))
     ON CONFLICT (student_id, term_code)
     DO UPDATE SET total_score = $3, updated_at = now(), rank = EXCLUDED.rank`,
    [student_id, term_code, sumPoint]
  );

  return { message: "Lưu thành công đánh giá", student_id, sumPoint };
};
```

**Giải thích:**
1. ✅ Lấy TẤT CẢ `criterion_id` của tiêu chí có `require_hsv_verify = TRUE`
2. ✅ Dùng `Set` để kiểm tra nhanh O(1) thay vì `includes()` O(n)
3. ✅ Set `score = 0` cho TẤT CẢ tiêu chí cần HSV xác nhận
4. ✅ Tính tổng điểm KHÔNG bao gồm tiêu chí cần HSV xác nhận

---

### **Giải pháp 2: Thêm Validation khi Admin thay đổi `require_hsv_verify`**

**File:** `backend/controllers/adminController.js`

```javascript
// ✅ Thêm vào hàm updateCriterion
export const updateCriterion = async (req, res, next) => {
  const { id } = req.params;
  const { require_hsv_verify } = req.body || {};

  // ... existing code ...

  // ✅ Kiểm tra xem có thay đổi require_hsv_verify không
  try {
    const existing = await getCriterionById(id);
    
    if (existing && existing.require_hsv_verify !== require_hsv_verify) {
      // ⚠️ Đang thay đổi require_hsv_verify
      
      // Kiểm tra xem có sinh viên nào đã tự đánh giá tiêu chí này chưa
      const assessmentCheck = await pool.query(
        `SELECT COUNT(*) as count 
         FROM drl.self_assessment 
         WHERE criterion_id = $1`,
        [id]
      );
      
      const assessmentCount = assessmentCheck.rows[0].count;
      
      if (assessmentCount > 0) {
        // ⚠️ Đã có sinh viên tự đánh giá
        
        if (existing.require_hsv_verify === true && require_hsv_verify === false) {
          // Case 1: Đang BỎ yêu cầu HSV xác nhận (TRUE → FALSE)
          // → Cần warning và recalculate điểm
          
          return res.status(400).json({
            error: "cannot_change_require_hsv_verify",
            message: `Không thể bỏ yêu cầu HSV xác nhận vì đã có ${assessmentCount} sinh viên đánh giá. Vui lòng reset điểm trước.`,
            assessmentCount
          });
          
        } else if (existing.require_hsv_verify === false && require_hsv_verify === true) {
          // Case 2: Đang THÊM yêu cầu HSV xác nhận (FALSE → TRUE)
          // → Cần set lại điểm = 0 cho tất cả sinh viên
          
          return res.status(400).json({
            error: "cannot_change_require_hsv_verify",
            message: `Không thể thêm yêu cầu HSV xác nhận vì đã có ${assessmentCount} sinh viên đánh giá. Điểm của sinh viên sẽ bị reset về 0.`,
            assessmentCount
          });
        }
      }
    }

    // Thực hiện update thông qua model
    const result = await updateCriterionById(id, {
      code: code.trim(),
      title: title.trim(),
      type: _type,
      max_points,
      display_order,
      require_hsv_verify,
      group_id: finalGroupId
    });

    if (!result) {
      return res.status(404).json({ error: "criterion_not_found_during_update" });
    }
    
    res.json(result);
  } catch (err) {
    console.error("Admin Update Criterion Error:", err);
    next(err);
  }
};
```

**Hoặc tốt hơn: Thêm API riêng để recalculate điểm**

```javascript
// ✅ API mới: POST /api/admin/criteria/:id/recalculate
export const recalculateCriterionScores = async (req, res, next) => {
  const { id } = req.params;
  
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    // 1. Lấy thông tin tiêu chí
    const criterion = await getCriterionById(id);
    if (!criterion) {
      return res.status(404).json({ error: "criterion_not_found" });
    }
    
    // 2. Lấy tất cả sinh viên đã đánh giá tiêu chí này
    const students = await client.query(
      `SELECT DISTINCT student_id, term_code 
       FROM drl.self_assessment 
       WHERE criterion_id = $1`,
      [id]
    );
    
    let recalculatedCount = 0;
    
    for (const { student_id, term_code } of students.rows) {
      // 3. Tính lại tổng điểm cho từng sinh viên
      const totalResult = await client.query(
        `SELECT COALESCE(SUM(self_score), 0) as total_score 
         FROM drl.self_assessment 
         WHERE student_id = $1 AND term_code = $2`,
        [student_id, term_code]
      );
      
      const totalScore = totalResult.rows[0].total_score;
      
      // 4. Cập nhật vào drl.term_score
      await client.query(
        `INSERT INTO drl.term_score (student_id, term_code, total_score, updated_at, rank)
         VALUES ($1, $2, $3, now(), drl.rank_by_score($3))
         ON CONFLICT (student_id, term_code)
         DO UPDATE SET total_score = $3, updated_at = now(), rank = EXCLUDED.rank`,
        [student_id, term_code, totalScore]
      );
      
      recalculatedCount++;
    }
    
    await client.query("COMMIT");
    
    res.json({
      ok: true,
      message: `Đã tính lại điểm cho ${recalculatedCount} sinh viên`,
      recalculatedCount
    });
    
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Recalculate Criterion Scores Error:", err);
    next(err);
  } finally {
    client.release();
  }
};
```

---

### **Giải pháp 3: Thêm Transaction Lock cho HSV xác nhận**

**File:** `backend/models/hsvModel.js`

```javascript
// ✅ Thêm row-level locking
export const postConfirm = async (
  student_code,
  term_code,
  criterion_code,
  participated,
  note,
  username
) => {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    // 1. Lock row để tránh race condition
    const sqlStudent = await client.query(
      `SELECT id FROM ref.student WHERE student_code = $1 FOR UPDATE`,
      [student_code]
    );

    if (!sqlStudent.rowCount) throw new Error('Không có sinh viên này');
    const studentID = sqlStudent.rows[0].id;

    // 2. Lấy id tiêu chí cần hsv xác nhận
    const sqlCriteria = await client.query(
      `SELECT id, max_points FROM drl.criterion 
       WHERE term_code = $1 AND code = $2 AND require_hsv_verify = TRUE 
       LIMIT 1`,
      [term_code, criterion_code]
    );
       
    if (!sqlCriteria.rowCount) throw new Error('Không có tiêu chí này');
    
    const criterionID = sqlCriteria.rows[0].id;
    const maxp = sqlCriteria.rows[0].max_points || 0;
    const score = participated ? maxp : 0;

    // 3. Lấy nội dung CLB mà sinh viên gửi lên HSV
    const cur = await client.query(
      `SELECT text_value FROM drl.self_assessment 
       WHERE student_id = $1 AND term_code = $2 AND criterion_id = $3`,
      [studentID, term_code, criterionID]
    );
    
    const currentText = cur.rowCount ? cur.rows[0].text_value : null;

    // 4. Insert/Update với lock
    await client.query(
      `INSERT INTO drl.self_assessment(
         student_id, term_code, criterion_id, text_value, self_score,
         is_hsv_verified, hsv_note, hsv_verified_by, hsv_verified_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7, now(), now())
       ON CONFLICT (student_id, term_code, criterion_id)
       DO UPDATE SET
         text_value      = COALESCE($4, drl.self_assessment.text_value),
         self_score      = EXCLUDED.self_score,
         is_hsv_verified = TRUE,
         hsv_note        = EXCLUDED.hsv_note,
         hsv_verified_by = EXCLUDED.hsv_verified_by,
         hsv_verified_at = now(),
         updated_at      = now()`,
      [studentID, term_code, criterionID, currentText, score, note || null, username]
    );

    // 5. Tính lại tổng điểm trong transaction
    const totalResult = await client.query(
      `SELECT COALESCE(SUM(self_score), 0) as total_score 
       FROM drl.self_assessment 
       WHERE student_id = $1 AND term_code = $2`,
      [studentID, term_code]
    );
    
    const totalScore = totalResult.rows[0].total_score;
    
    await client.query(
      `INSERT INTO drl.term_score (student_id, term_code, total_score, updated_at, rank)
       VALUES ($1, $2, $3, now(), drl.rank_by_score($3))
       ON CONFLICT (student_id, term_code)
       DO UPDATE SET total_score = $3, updated_at = now(), rank = EXCLUDED.rank`,
      [studentID, term_code, totalScore]
    );
    
    await client.query("COMMIT");
    
    return {
      message: "Xác nhận thành công",
      studentID,
      term_code,
      criterionID,
      currentText,
      score,
      note,
      username,
      totalScore
    };
    
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
```

**Giải thích:**
- ✅ Dùng `FOR UPDATE` để lock row trong transaction
- ✅ Tất cả operations trong 1 transaction
- ✅ Tránh race condition khi nhiều HSV xác nhận đồng thời

---

### **Giải pháp 4: Cải thiện UI cho sinh viên**

**File:** `frontend/src/components/drl/AssessmentForm.jsx`

```jsx
// ✅ Hiển thị rõ tiêu chí cần HSV xác nhận
const renderCriterion = (criterion) => {
  const requiresHSV = criterion.require_hsv_verify;
  
  return (
    <div className="criterion-item">
      <div className="d-flex align-items-center gap-2">
        <h6>{criterion.code}. {criterion.title}</h6>
        {requiresHSV && (
          <Badge bg="warning" text="dark">
            <i className="bi bi-shield-check me-1"></i>
            Cần HSV xác nhận
          </Badge>
        )}
      </div>
      
      {requiresHSV ? (
        // Tiêu chí cần HSV xác nhận
        <>
          <Form.Group className="mb-3">
            <Form.Label>Nội dung hoạt động</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Ghi rõ tên CLB/Đoàn thể, vai trò, thời gian..."
              value={formData[criterion.id]?.text_value || ''}
              onChange={(e) => handleTextChange(criterion.id, e.target.value)}
            />
          </Form.Group>
          
          <Alert variant="info" className="small">
            <i className="bi bi-info-circle me-2"></i>
            Điểm của tiêu chí này sẽ được <b>Hội Sinh Viên</b> xác nhận sau. 
            Hiện tại điểm = <b>0</b> (chưa tính vào tổng điểm).
          </Alert>
          
          <div className="text-muted small">
            Điểm: <b>0</b> / {criterion.max_points} 
            (Chờ HSV xác nhận)
          </div>
        </>
      ) : (
        // Tiêu chí thường
        <CriterionRadioOptions
          criterion={criterion}
          value={formData[criterion.id]}
          onChange={handleOptionChange}
        />
      )}
    </div>
  );
};
```

---

### **Giải pháp 5: Thêm Audit Trail**

**Database Schema:**

```sql
-- ✅ Tạo bảng audit trail
CREATE TABLE drl.hsv_verification_history (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES ref.student(id),
  term_code VARCHAR NOT NULL,
  criterion_id INT NOT NULL REFERENCES drl.criterion(id),
  
  -- Trạng thái trước và sau
  old_score INT,
  new_score INT,
  old_is_verified BOOLEAN,
  new_is_verified BOOLEAN,
  old_note TEXT,
  new_note TEXT,
  
  -- Metadata
  verified_by VARCHAR NOT NULL, -- Username của HSV
  verified_at TIMESTAMP NOT NULL DEFAULT now(),
  action VARCHAR NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
  
  -- IP, user agent (optional)
  client_ip VARCHAR,
  user_agent TEXT
);

-- Index
CREATE INDEX idx_hsv_history_student 
ON drl.hsv_verification_history(student_id, term_code);

CREATE INDEX idx_hsv_history_criterion 
ON drl.hsv_verification_history(criterion_id);

CREATE INDEX idx_hsv_history_time 
ON drl.hsv_verification_history(verified_at DESC);
```

**Code thêm vào `hsvModel.js`:**

```javascript
// ✅ Hàm log history
const logVerificationHistory = async (client, data) => {
  const {
    student_id,
    term_code,
    criterion_id,
    old_score,
    new_score,
    old_is_verified,
    new_is_verified,
    old_note,
    new_note,
    verified_by,
    action
  } = data;
  
  await client.query(
    `INSERT INTO drl.hsv_verification_history 
     (student_id, term_code, criterion_id, 
      old_score, new_score, 
      old_is_verified, new_is_verified,
      old_note, new_note,
      verified_by, action)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      student_id, term_code, criterion_id,
      old_score, new_score,
      old_is_verified, new_is_verified,
      old_note, new_note,
      verified_by, action
    ]
  );
};

// ✅ Cập nhật postConfirm để log history
export const postConfirm = async (...args) => {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    // ... existing code ...
    
    // Lấy dữ liệu cũ trước khi update
    const oldData = await client.query(
      `SELECT self_score, is_hsv_verified, hsv_note 
       FROM drl.self_assessment 
       WHERE student_id = $1 AND term_code = $2 AND criterion_id = $3`,
      [studentID, term_code, criterionID]
    );
    
    const old = oldData.rowCount ? oldData.rows[0] : {
      self_score: 0,
      is_hsv_verified: false,
      hsv_note: null
    };
    
    // Update self_assessment
    // ... existing code ...
    
    // ✅ Log vào history
    await logVerificationHistory(client, {
      student_id: studentID,
      term_code,
      criterion_id: criterionID,
      old_score: old.self_score,
      new_score: score,
      old_is_verified: old.is_hsv_verified,
      new_is_verified: true,
      old_note: old.hsv_note,
      new_note: note,
      verified_by: username,
      action: oldData.rowCount ? 'UPDATE' : 'CREATE'
    });
    
    await client.query("COMMIT");
    
    return { ... };
    
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
```

---

## 📊 Luồng Chuẩn Đề Xuất (TO-BE)

### **Luồng 1: Admin tạo tiêu chí cần HSV xác nhận**

```
1. Admin → AdminCriteriaPage.jsx
   ↓
   Tạo tiêu chí mới:
   - Code: "2.1"
   - Title: "Tham gia hoạt động Đoàn - HSV"
   - Type: "text"
   - Max points: 10
   - ✅ Checkbox "Tiêu chí cần hội sinh viên xác nhận" = TRUE
   ↓
2. POST /api/admin/criteria
   ↓
3. Database: drl.criterion
   - require_hsv_verify = TRUE ✅
```

---

### **Luồng 2: Sinh viên tự đánh giá**

```
1. Student → SelfAssessmentPage.jsx
   ↓
2. Load tiêu chí: GET /api/drl/criteria?term=2026HK1
   ↓
3. Frontend hiển thị:
   
   ┌─────────────────────────────────────────────┐
   │ 2.1. Tham gia hoạt động Đoàn - HSV         │
   │ [Badge: Cần HSV xác nhận]                   │
   │                                             │
   │ Nội dung hoạt động:                         │
   │ ┌─────────────────────────────────────────┐ │
   │ │ Tôi tham gia CLB Lập Trình từ 2024...  │ │
   │ └─────────────────────────────────────────┘ │
   │                                             │
   │ [Info] Điểm sẽ được HSV xác nhận sau.      │
   │ Hiện tại: 0 / 10 (Chờ HSV xác nhận)       │
   └─────────────────────────────────────────────┘
   
4. Student nhập nội dung và click "Lưu đánh giá"
   ↓
5. POST /api/drl/submit
   Body: {
     items: [
       { criterion_id: 1, score: 25 },  // Tiêu chí 1.1
       { criterion_id: 10, text_value: "Tôi tham gia CLB...", score: 0 }, // ✅ Tiêu chí 2.1
     ]
   }
   ↓
6. Backend (drlModel.js):
   
   // ✅ Lấy tất cả tiêu chí cần HSV xác nhận
   const hsvRequiredIds = await getCriteriaRequireHSV(term_code);
   // → [10] (criterion_id = 10)
   
   // ✅ Set score = 0 cho tiêu chí cần HSV
   for (const it of items) {
     if (hsvRequiredIds.has(it.criterion_id)) {
       it.score = 0; // ✅ Force score = 0
     }
     // Insert vào drl.self_assessment
   }
   
   // ✅ Tính tổng điểm KHÔNG bao gồm tiêu chí cần HSV
   const sumPoint = items
     .filter(x => !hsvRequiredIds.has(x.criterion_id))
     .reduce((sum, x) => sum + x.score, 0);
   // → 25 + 0 = 25 (KHÔNG tính điểm tiêu chí 2.1)
   
7. Database:
   - drl.self_assessment:
     * criterion_id = 10, self_score = 0, is_hsv_verified = FALSE ✅
   - drl.term_score:
     * total_score = 25 ✅ (Chưa tính điểm tiêu chí 2.1)
```

---

### **Luồng 3: HSV xác nhận**

```
1. HSV → ViewHSVClassesPage.jsx
   ↓
2. Chọn lớp → HSVStudentList.jsx
   ↓
3. GET /api/hsv/students?class_code=...&term=2026HK1
   ↓
4. Backend query:
   
   SELECT s.student_code, s.full_name,
          ctn.code AS criterion_code,
          sa.self_score, -- = 0
          sa.text_value, -- = "Tôi tham gia CLB..."
          sa.is_hsv_verified, -- = FALSE
          sa.hsv_note
   FROM ref.student s
   LEFT JOIN drl.criterion ctn 
     ON ctn.require_hsv_verify = TRUE ✅
   LEFT JOIN drl.self_assessment sa ...
   
5. Frontend hiển thị:
   
   ┌────────────────────────────────────────────────────────┐
   │ MSV      │ Họ tên       │ Tiêu chí │ Điểm │ Ghi chú SV  │
   ├────────────────────────────────────────────────────────┤
   │ 2021001  │ Nguyễn Văn A │ 2.1      │ 0    │ Tham gia... │
   │                                                          │
   │ Tham gia: [✓] Có  [ ] Không                            │
   │ Ghi chú HSV: [Đã xác minh với CLB]                     │
   │ [Button: Xác nhận]                                      │
   └────────────────────────────────────────────────────────┘
   
6. HSV check checkbox "Có" và click "Xác nhận"
   ↓
7. POST /api/hsv/confirm
   Body: {
     student_code: "2021001",
     term_code: "2026HK1",
     criterion_code: "2.1",
     participated: true, ✅
     note: "Đã xác minh với CLB"
   }
   ↓
8. Backend (hsvModel.js):
   
   BEGIN TRANSACTION; ✅
   
   // Lock row
   SELECT id FROM ref.student WHERE ... FOR UPDATE;
   
   // Tính điểm
   const score = participated ? max_points : 0;
   // → participated = TRUE → score = 10 ✅
   
   // Update self_assessment
   INSERT INTO drl.self_assessment (...)
   VALUES (..., score = 10, is_hsv_verified = TRUE)
   ON CONFLICT DO UPDATE SET
     self_score = 10,
     is_hsv_verified = TRUE,
     hsv_verified_by = 'hsv_username',
     hsv_verified_at = now()
   
   // ✅ Log vào audit trail
   INSERT INTO drl.hsv_verification_history (...)
   
   // Tính lại tổng điểm
   SELECT SUM(self_score) FROM drl.self_assessment
   WHERE student_id = ... AND term_code = ...
   // → 25 + 10 = 35 ✅
   
   // Update term_score
   UPDATE drl.term_score SET total_score = 35
   
   COMMIT; ✅
   
9. Response:
   {
     message: "Xác nhận thành công",
     score: 10,
     totalScore: 35
   }
   
10. Frontend update UI:
    - Điểm tiêu chí 2.1: 0 → 10 ✅
    - Badge: "Chưa xác nhận" → "Đã xác nhận" ✅
    - Button: "Xác nhận" → "Cập nhật" ✅
```

---

### **Luồng 4: Admin thay đổi `require_hsv_verify`**

```
Case 1: Admin muốn BỎ yêu cầu HSV xác nhận (TRUE → FALSE)

1. Admin → AdminCriteriaPage.jsx
   ↓
   Uncheck "Tiêu chí cần hội sinh viên xác nhận"
   ↓
2. PUT /api/admin/criteria/:id
   Body: { require_hsv_verify: false }
   ↓
3. Backend validation:
   
   // Kiểm tra có sinh viên nào đã đánh giá chưa
   SELECT COUNT(*) FROM drl.self_assessment 
   WHERE criterion_id = :id
   
   IF count > 0 THEN
     ❌ Response 400:
     {
       error: "cannot_change_require_hsv_verify",
       message: "Không thể bỏ yêu cầu HSV vì đã có 50 sinh viên đánh giá. 
                 Vui lòng dùng chức năng 'Tính lại điểm' sau khi thay đổi."
     }
   END IF
   
4. Admin phải confirm và dùng API riêng:
   ↓
   POST /api/admin/criteria/:id/recalculate
   ↓
   Backend:
   - Tính lại điểm cho TẤT CẢ sinh viên ✅
   - Update drl.term_score ✅
   - Return: { recalculatedCount: 50 }

---

Case 2: Admin muốn THÊM yêu cầu HSV xác nhận (FALSE → TRUE)

1-2. Tương tự Case 1
   ↓
3. Backend validation:
   
   IF count > 0 THEN
     ❌ Response 400:
     {
       error: "cannot_change_require_hsv_verify",
       message: "Không thể thêm yêu cầu HSV vì đã có 50 sinh viên đánh giá. 
                 Điểm của sinh viên sẽ bị SET VỀ 0 và cần HSV xác nhận lại."
     }
   END IF
   
4. Admin confirm → API set điểm = 0:
   ↓
   POST /api/admin/criteria/:id/reset-scores
   ↓
   Backend:
   UPDATE drl.self_assessment 
   SET self_score = 0, is_hsv_verified = FALSE
   WHERE criterion_id = :id
   
   // Tính lại tổng điểm
   FOR EACH student DO
     Recalculate total_score
   END FOR
```

---

## 🎯 Tóm Tắt Kiến Nghị

### **Cần Fix Ngay (Priority HIGH)**

1. ✅ **Fix logic kiểm tra `require_hsv_verify`** trong `drlModel.js`
   - Lấy TẤT CẢ criterion_id cần HSV xác nhận
   - Dùng Set thay vì includes()
   - Tính tổng điểm chính xác

2. ✅ **Thêm Transaction Lock** trong `hsvModel.js`
   - Dùng `FOR UPDATE` để tránh race condition
   - Tất cả operations trong 1 transaction

3. ✅ **Thêm Validation** khi Admin thay đổi `require_hsv_verify`
   - Warning nếu đã có sinh viên đánh giá
   - API riêng để recalculate điểm

### **Nên Làm (Priority MEDIUM)**

4. ✅ **Cải thiện UI** cho sinh viên
   - Badge "Cần HSV xác nhận"
   - Alert giải thích điểm = 0
   - Hiển thị trạng thái rõ ràng

5. ✅ **Thêm Audit Trail**
   - Bảng `drl.hsv_verification_history`
   - Log tất cả thay đổi
   - Metadata (username, timestamp, IP)

### **Có thể làm sau (Priority LOW)**

6. ✅ **Dashboard cho Admin**
   - Thống kê số tiêu chí cần HSV xác nhận
   - Số sinh viên chờ HSV xác nhận
   - Progress bar

7. ✅ **Notification cho HSV**
   - Email/SMS khi có sinh viên mới đánh giá
   - Dashboard HSV với số lượng pending

---

## 📈 Ưu/Nhược Điểm của Giải Pháp

### **Ưu Điểm**

✅ **Data Integrity**: Điểm luôn chính xác, không bị tính sai  
✅ **Security**: Transaction lock tránh race condition  
✅ **Auditability**: Có audit trail để truy vết  
✅ **UX**: Sinh viên hiểu rõ luồng, không bị confusion  
✅ **Maintainability**: Code rõ ràng, dễ maintain  

### **Nhược Điểm / Trade-offs**

⚠️ **Performance**: Transaction lock có thể làm chậm khi HSV xác nhận đồng thời nhiều sinh viên  
→ **Giải pháp**: Dùng optimistic locking hoặc queue  

⚠️ **Complexity**: Thêm nhiều validation logic  
→ **Giải pháp**: Document rõ ràng, test kỹ  

⚠️ **Breaking Change**: Cần migrate dữ liệu cũ  
→ **Giải pháp**: Script migration, rollback plan  

---

## 🧪 Test Cases Đề Xuất

### **Test Case 1: Sinh viên tự đánh giá tiêu chí cần HSV**
```
Given: Tiêu chí 2.1 có require_hsv_verify = TRUE
When: Sinh viên tự đánh giá và nhập nội dung
Then: 
  - Điểm tiêu chí 2.1 = 0 ✅
  - Tổng điểm KHÔNG bao gồm tiêu chí 2.1 ✅
  - is_hsv_verified = FALSE ✅
```

### **Test Case 2: HSV xác nhận tham gia**
```
Given: Sinh viên đã tự đánh giá tiêu chí 2.1
When: HSV check checkbox "Tham gia" = TRUE
Then:
  - Điểm tiêu chí 2.1 = max_points (10) ✅
  - Tổng điểm tăng lên 10 điểm ✅
  - is_hsv_verified = TRUE ✅
  - Có record trong audit trail ✅
```

### **Test Case 3: HSV xác nhận KHÔNG tham gia**
```
Given: Sinh viên đã tự đánh giá tiêu chí 2.1
When: HSV check checkbox "Tham gia" = FALSE
Then:
  - Điểm tiêu chí 2.1 = 0 ✅
  - Tổng điểm không thay đổi ✅
  - is_hsv_verified = TRUE ✅ (Đã xác nhận là KHÔNG tham gia)
```

### **Test Case 4: Admin đổi require_hsv_verify khi đã có data**
```
Given: Tiêu chí 2.1 đã có 50 sinh viên đánh giá
When: Admin unchecked "Cần HSV xác nhận"
Then:
  - Response 400 ❌
  - Message: "Không thể thay đổi, vui lòng reset điểm trước"
  - Không update database
```

### **Test Case 5: Race condition khi 2 HSV xác nhận đồng thời**
```
Given: 2 HSV cùng xem sinh viên A
When: HSV1 và HSV2 đồng thời click "Xác nhận"
Then:
  - Chỉ 1 request thành công (do row lock) ✅
  - Request còn lại wait hoặc fail gracefully
  - Điểm không bị tính sai ✅
```

---

## 📝 Migration Plan

### **Phase 1: Hotfix (1-2 ngày)**
- ✅ Fix logic `postSelfAssessment` trong `drlModel.js`
- ✅ Deploy hotfix lên production
- ✅ Test manual với data thật

### **Phase 2: Stability (3-5 ngày)**
- ✅ Thêm transaction lock trong `hsvModel.js`
- ✅ Thêm validation trong `adminController.js`
- ✅ Viết unit tests
- ✅ Deploy lên staging → test → production

### **Phase 3: Enhancement (1-2 tuần)**
- ✅ Cải thiện UI/UX
- ✅ Thêm audit trail
- ✅ Dashboard & reports
- ✅ Viết documentation

---

## 🔗 Files Cần Sửa

### **Backend**
1. `backend/models/drlModel.js` (lines 48-88) - **FIX CRITICAL**
2. `backend/models/hsvModel.js` (lines 62-114) - **ADD TRANSACTION**
3. `backend/controllers/adminController.js` (lines 260-371) - **ADD VALIDATION**
4. `backend/models/adminModel/criteriaModel.js` - **NO CHANGE**

### **Frontend**
5. `frontend/src/components/drl/AssessmentForm.jsx` - **IMPROVE UI**
6. `frontend/src/components/drl/HSVStudentRow.jsx` - **NO CHANGE**
7. `frontend/src/pages/admin/AdminCriteriaPage.jsx` - **ADD WARNING MODAL**

### **Database**
8. `migrations/add_hsv_verification_history.sql` - **NEW TABLE**
9. `migrations/recalculate_term_scores.sql` - **DATA FIX**

---

## ✅ Conclusion

Luồng hiện tại có **6 vấn đề nghiêm trọng** cần fix ngay:
1. ❌ Logic kiểm tra `require_hsv_verify` SAI
2. ❌ Tính tổng điểm SAI
3. ❌ Không validation khi Admin thay đổi
4. ❌ Race condition khi HSV xác nhận
5. ❌ UI không rõ ràng
6. ❌ Không có audit trail

**Giải pháp đề xuất** đã cover toàn bộ 6 vấn đề với:
- ✅ Code fix cụ thể
- ✅ Database schema
- ✅ Migration plan
- ✅ Test cases
- ✅ UX improvements

**Priority**: 
1. Fix logic `drlModel.js` (CRITICAL)
2. Add transaction lock `hsvModel.js` (HIGH)
3. Add validation `adminController.js` (HIGH)
4. UI improvements (MEDIUM)
5. Audit trail (MEDIUM)

---

**Created**: 2025-11-24  
**Author**: GitHub Copilot  
**Status**: Ready for Review
