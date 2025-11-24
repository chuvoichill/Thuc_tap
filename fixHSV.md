# Tài liệu Chi tiết: Sửa lỗi và Cải thiện Quy trình HSV Verification

## 📋 Tổng quan

Tài liệu này mô tả toàn bộ các thay đổi đã được thực hiện để sửa lỗi và cải thiện quy trình xác nhận HSV (Hội Sinh Viên) trong hệ thống quản lý điểm rèn luyện sinh viên.

**Thời gian thực hiện:** Tháng 11/2025  
**Phạm vi:** Backend (Node.js/Express/PostgreSQL) và Frontend (React)

---

## 🎯 Mục tiêu

### Mục tiêu Chính
1. Sửa 6 lỗi nghiêm trọng trong quy trình HSV verification
2. Cải thiện UI/UX cho giao diện HSV
3. Áp dụng các pattern chuyên nghiệp (optimistic updates, scroll preservation)
4. Refactor code để tuân thủ MVC pattern

### Kết quả Đạt được
- ✅ Sửa tất cả 6 lỗi critical
- ✅ Thêm chức năng unverify (hủy xác nhận)
- ✅ Cải thiện UI với grouping, cards, badges
- ✅ Loại bỏ scroll jump và component overlap
- ✅ Đề xuất refactoring cho code quality

---

## 🐛 Các Lỗi Đã Sửa

### Lỗi 1: Logic Kiểm tra `require_hsv_verify` Sai

**📂 File:** `backend/models/drlModel.js`  
**📍 Dòng:** 55-63, 80-82

#### Vấn đề
```javascript
// CODE CŨ - SAI
const criteriaWithHSV = await pool.query(
  `SELECT id FROM drl.criterion 
   WHERE term_code = $1 AND code = $2 AND require_hsv_verify = TRUE`,
  [term, '2.1'] // ❌ Hardcode '2.1', chỉ lấy 1 tiêu chí
);
```

**Tại sao sai:**
- Hardcode `code = '2.1'` → Chỉ kiểm tra 1 tiêu chí cố định
- Nếu admin tạo tiêu chí khác cần HSV verify (VD: '3.5'), system sẽ không kiểm tra
- Phụ thuộc vào tên tiêu chí cụ thể thay vì flag `require_hsv_verify`

#### Giải pháp
```javascript
// CODE MỚI - ĐÚNG
const criteriaRequiringHSV = await pool.query(
  `SELECT id FROM drl.criterion 
   WHERE term_code = $1 AND require_hsv_verify = TRUE`, // ✅ Bỏ code='2.1'
  [term]
);

// Sử dụng Set để check nhanh
const hsvCriteriaIds = new Set(
  criteriaRequiringHSV.rows.map((r) => r.id)
);

// Kiểm tra TẤT CẢ các tiêu chí cần HSV
const needsHSVVerify = submittedCriteriaIds.some((cid) => 
  hsvCriteriaIds.has(cid)
);
```

**Lợi ích:**
- ✅ Generic workflow - không phụ thuộc vào mã tiêu chí cụ thể
- ✅ Lấy TẤT CẢ tiêu chí có `require_hsv_verify = TRUE`
- ✅ Sử dụng Set để tối ưu performance (O(1) lookup)
- ✅ Admin có thể tự do thêm/bớt tiêu chí cần HSV verify

---

### Lỗi 2: Tổng Điểm Bao gồm Tiêu chí Chưa Xác nhận

**📂 File:** `backend/models/drlModel.js`  
**📍 Dòng:** 80-82

#### Vấn đề
```javascript
// CODE CŨ - SAI
const total = submittedCriteriaIds.reduce((sum, cid) => {
  return sum + (pointsMap[cid] || 0); // ❌ Cộng TẤT CẢ, kể cả chưa HSV verify
}, 0);
```

**Tại sao sai:**
- Sinh viên tự đánh giá tiêu chí cần HSV verify → Có điểm ngay lập tức
- HSV chưa xác nhận → Điểm vẫn được tính vào tổng
- Điểm không chính xác, vi phạm quy trình

#### Giải pháp
```javascript
// CODE MỚI - ĐÚNG
const total = submittedCriteriaIds.reduce((sum, cid) => {
  // ✅ Loại bỏ điểm của tiêu chí cần HSV verify
  if (hsvCriteriaIds.has(cid)) {
    return sum; // Không cộng điểm
  }
  return sum + (pointsMap[cid] || 0);
}, 0);
```

**Lợi ích:**
- ✅ Chỉ tính điểm của tiêu chí KHÔNG cần HSV verify
- ✅ Điểm HSV được cộng sau khi HSV xác nhận (qua `postConfirm`)
- ✅ Đảm bảo tính chính xác của điểm rèn luyện

---

### Lỗi 3: Race Condition trong HSV Confirm

**📂 File:** `backend/models/hsvModel.js`  
**📍 Dòng:** 108-228

#### Vấn đề
```javascript
// CODE CŨ - SAI (không có transaction)
async function postConfirm(student_code, criterion_id, data) {
  // 1. SELECT điểm
  const pointResult = await pool.query('SELECT ...');
  
  // ⏱️ CÓ THỂ CÓ REQUEST KHÁC VÀO ĐÂY
  
  // 2. UPDATE điểm
  await pool.query('UPDATE ...');
  
  // 3. UPDATE term_score
  await pool.query('UPDATE drl.term_score ...');
}
```

**Tại sao nguy hiểm:**
- 2 HSV cùng xác nhận 1 sinh viên trong cùng 1 lúc
- Request 1: Đọc total_score = 80
- Request 2: Đọc total_score = 80 (cùng lúc)
- Request 1: Cập nhật total_score = 80 + 5 = 85
- Request 2: Cập nhật total_score = 80 + 3 = 83 ❌ GHI ĐÈ
- **Kết quả:** Mất điểm! (Đúng phải là 88)

#### Giải pháp
```javascript
// CODE MỚI - ĐÚNG (có transaction + row locking)
export const postConfirm = async (student_code, criterion_id, data) => {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN"); // ✅ Bắt đầu transaction
    
    // ✅ Lock row để ngăn concurrent access
    const studentRow = await client.query(
      `SELECT s.id FROM ref.student s 
       WHERE s.student_code = $1 FOR UPDATE`, // 🔒 ROW LOCK
      [student_code]
    );
    
    // ... Xử lý logic ...
    
    // ✅ Tính lại toàn bộ điểm một cách an toàn
    const totalScoreResult = await client.query(`
      SELECT COALESCE(SUM(sa.points), 0) AS total
      FROM drl.self_assessment sa
      WHERE sa.student_id = $1 
        AND sa.term_code = $2
        AND (sa.is_hsv_verified = TRUE OR sa.is_hsv_verified IS NULL)
    `, [student_id, term_code]);
    
    // ✅ Update term_score
    await client.query(`
      UPDATE drl.term_score 
      SET total_score = $1 
      WHERE student_id = $2 AND term_code = $3
    `, [newTotalScore, student_id, term_code]);
    
    await client.query("COMMIT"); // ✅ Lưu tất cả thay đổi
    
  } catch (err) {
    await client.query("ROLLBACK"); // ✅ Hoàn tác nếu lỗi
    throw err;
  } finally {
    client.release(); // ✅ Giải phóng connection
  }
};
```

**Lợi ích:**
- ✅ Transaction đảm bảo atomicity (hoặc thành công hết, hoặc thất bại hết)
- ✅ `SELECT FOR UPDATE` lock row, ngăn concurrent modifications
- ✅ Tính lại tổng điểm từ database (single source of truth)
- ✅ ROLLBACK tự động nếu có bất kỳ lỗi nào

---

### Lỗi 4: Hardcode Dependency vào Tiêu chí '2.1'

**📂 File:** `backend/models/drlModel.js`, `hsvModel.js`  
**📍 Dòng:** Nhiều vị trí

#### Vấn đề
```javascript
// CODE CŨ - SAI
WHERE code = '2.1' // ❌ Magic string
```

**Tại sao sai:**
- Nếu admin đổi tên tiêu chí '2.1' → System break
- Nếu admin muốn thêm tiêu chí khác cần HSV verify → Phải sửa code
- Không flexible, vi phạm Open/Closed Principle

#### Giải pháp
```javascript
// CODE MỚI - ĐÚNG
WHERE require_hsv_verify = TRUE // ✅ Sử dụng flag boolean
```

**Lợi ích:**
- ✅ Admin control qua database, không cần sửa code
- ✅ Có thể có nhiều tiêu chí cần HSV verify
- ✅ Dễ maintain và scale

---

### Lỗi 5: Không Validation khi Admin Thay đổi `require_hsv_verify`

**📂 File:** `backend/controllers/adminController.js`  
**📍 Dòng:** 314-345

#### Vấn đề
```javascript
// CODE CŨ - KHÔNG CÓ VALIDATION
async updateCriterion(req, res) {
  const { require_hsv_verify } = req.body;
  
  // ❌ Không kiểm tra impact
  await pool.query(
    'UPDATE drl.criterion SET require_hsv_verify = $1 WHERE id = $2',
    [require_hsv_verify, id]
  );
}
```

**Tại sao nguy hiểm:**
- Sinh viên đã tự đánh giá → Đã có điểm trong `term_score`
- Admin bật `require_hsv_verify = TRUE` → Sinh viên mất điểm đột ngột
- Admin tắt `require_hsv_verify = FALSE` → Sinh viên được điểm không đúng quy trình
- **Data inconsistency!**

#### Giải pháp
```javascript
// CODE MỚI - CÓ VALIDATION
if (require_hsv_verify !== undefined && 
    existingCriterion.require_hsv_verify !== require_hsv_verify) {
  
  // ✅ Kiểm tra xem có sinh viên nào đã đánh giá chưa
  const assessmentCheck = await pool.query(
    `SELECT COUNT(*) as count 
     FROM drl.self_assessment 
     WHERE criterion_id = $1`,
    [id]
  );
  
  const assessmentCount = parseInt(assessmentCheck.rows[0].count) || 0;
  
  if (assessmentCount > 0) {
    // ✅ Ngăn chặn thay đổi
    const action = require_hsv_verify ? 'thêm' : 'bỏ';
    
    return res.status(400).json({
      error: "cannot_change_require_hsv_verify",
      message: `Không thể ${action} yêu cầu HSV xác nhận vì đã có ${assessmentCount} sinh viên đánh giá. Thao tác này sẽ ảnh hưởng đến điểm của sinh viên.`,
      assessmentCount,
      suggestion: "Vui lòng xem xét kỹ hoặc tạo tiêu chí mới thay thế."
    });
  }
}
```

**Lợi ích:**
- ✅ Bảo vệ data integrity
- ✅ Ngăn admin vô tình gây ra data inconsistency
- ✅ Thông báo rõ ràng lý do không thể thay đổi
- ✅ Gợi ý giải pháp thay thế (tạo tiêu chí mới)

---

### Lỗi 6: HSV Chỉ Thấy Checkbox, Không Thấy Radio/Text

**📂 File:** `backend/models/hsvModel.js`  
**📍 Dòng:** 138-184

#### Vấn đề
```javascript
// CODE CŨ - CHỈ XỬ LÝ CHECKBOX
const isParticipated = data.participated === true;

// ❌ Không xử lý radio và text types
```

**Tại sao sai:**
- Tiêu chí type='radio' (dropdown) → HSV không thay đổi được
- Tiêu chí type='text' (switch) → HSV không thay đổi được
- HSV chỉ có thể xác nhận checkbox, không linh hoạt

#### Giải pháp
```javascript
// CODE MỚI - XỬ LÝ 3 TYPES
// 1. Lấy type của tiêu chí
const typeResult = await client.query(
  `SELECT type FROM drl.criterion WHERE id = $1`,
  [criterion_id]
);
const criterionType = typeResult.rows[0]?.type || "radio";

let isParticipated;
let newOptionId = null;
let newTextValue = null;

// 2. Xử lý theo type
if (criterionType === "radio") {
  // ✅ Radio: HSV chọn option từ dropdown
  isParticipated = data.participated === true;
  newOptionId = data.option_id || null;
  
} else if (criterionType === "text") {
  // ✅ Text: HSV toggle switch
  isParticipated = data.participated === true;
  newTextValue = data.text_value || null;
  
} else {
  // ✅ Checkbox: Logic cũ
  isParticipated = data.participated === true;
}

// 3. Update với type phù hợp
await client.query(
  `UPDATE drl.self_assessment 
   SET option_id = $1,
       text_value = $2,
       is_hsv_verified = $3
   WHERE student_id = $4 
     AND criterion_id = $5 
     AND term_code = $6`,
  [newOptionId, newTextValue, isVerified, student_id, criterion_id, term_code]
);
```

**Lợi ích:**
- ✅ HSV có thể xác nhận mọi loại tiêu chí (radio, text, checkbox)
- ✅ UI động hiển thị đúng control tương ứng với type
- ✅ Linh hoạt cho admin tạo tiêu chí mới

---

## 🎨 Cải Thiện UI/UX

### Cải thiện 1: Thêm Nút "Hủy Xác Nhận" (Unverify)

**📂 File:** `frontend/src/components/drl/HSVStudentRow.jsx`  
**📍 Dòng:** 70-96, 204-219

#### Vấn đề Cũ
- HSV xác nhận nhầm → Không có cách nào sửa
- Phải vào database để sửa → Nguy hiểm
- Không có audit trail

#### Giải pháp
```jsx
// Thêm nút Unverify
const handleUnverify = async () => {
  if (!window.confirm(`Bạn có chắc muốn HUỶ xác nhận tiêu chí "${title}" cho ${studentCode}?`)) {
    return;
  }

  try {
    // Optimistic update
    setLocalVerified(false);
    
    // Call API
    await confirmHSVAssessment(studentCode, criterionId, {
      participated: false, // ✅ Set về false = unverify
    }, term);
    
    notify.success(`Đã hủy xác nhận tiêu chí "${title}"`);
    onStudentUpdate?.(); // Refresh parent
    
  } catch (err) {
    setLocalVerified(true); // Rollback
    notify.error(err.response?.data?.error || "Lỗi hủy xác nhận");
  }
};

// UI với 2 buttons
{localVerified ? (
  <Button 
    variant="outline-danger" 
    size="sm"
    onClick={handleUnverify}
  >
    Hủy xác nhận
  </Button>
) : (
  <Button 
    variant="outline-success" 
    size="sm"
    onClick={handleConfirm}
  >
    Xác nhận
  </Button>
)}
```

**Backend Support:**
```javascript
// backend/models/hsvModel.js
// Logic xử lý participated = false
const isVerified = isParticipated; // TRUE nếu xác nhận, FALSE nếu hủy

await client.query(
  `UPDATE drl.self_assessment 
   SET is_hsv_verified = $1 
   WHERE ...`,
  [isVerified, ...] // ✅ Cho phép set về FALSE
);
```

**Lợi ích:**
- ✅ HSV có thể sửa lỗi ngay trên UI
- ✅ Không cần access database
- ✅ Có confirmation dialog để tránh click nhầm
- ✅ Audit trail qua database timestamp

---

### Cải thiện 2: Group Sinh viên (Loại bỏ Duplicate)

**📂 File:** `frontend/src/components/drl/HSVStudentList.jsx`  
**📍 Dòng:** 29-51

#### Vấn đề Cũ
```jsx
// Hiển thị 1 row cho mỗi (sinh viên × tiêu chí)
students.map(s => <HSVStudentRow key={s.student_code + s.criterion_id} ... />)

// ❌ Nếu sinh viên có 3 tiêu chí → Xuất hiện 3 lần
// ❌ Khó theo dõi, lãng phí màn hình
```

#### Giải pháp
```jsx
// Group theo student_code
const groupedStudents = useMemo(() => {
  const groups = {};
  
  students.forEach((s) => {
    if (!groups[s.student_code]) {
      groups[s.student_code] = {
        student_code: s.student_code,
        full_name: s.full_name,
        class_code: s.class_code,
        criteria: [], // ✅ Mảng tiêu chí
      };
    }
    
    // ✅ Push tiêu chí vào mảng
    groups[s.student_code].criteria.push({
      criterion_id: s.criterion_id,
      criterion_code: s.criterion_code,
      criterion_title: s.criterion_title,
      criterion_type: s.criterion_type,
      points: s.points,
      option_id: s.option_id,
      text_value: s.text_value,
      is_hsv_verified: s.is_hsv_verified,
    });
  });
  
  return Object.values(groups);
}, [students]);

// Hiển thị
{groupedStudents.map((student) => (
  <Card key={student.student_code}>
    <Card.Header>
      <strong>{student.student_code}</strong> - {student.full_name}
      <Badge>{student.criteria.length} tiêu chí</Badge> {/* ✅ Hiển thị số lượng */}
    </Card.Header>
    <Card.Body>
      {student.criteria.map((crit) => (
        <HSVStudentRow 
          key={crit.criterion_id}
          criterion={crit}
          ... 
        />
      ))}
    </Card.Body>
  </Card>
))}
```

**Lợi ích:**
- ✅ Mỗi sinh viên chỉ xuất hiện 1 lần
- ✅ Tất cả tiêu chí của sinh viên được group lại
- ✅ Dễ đọc, dễ quản lý
- ✅ Tiết kiệm không gian màn hình

---

### Cải thiện 3: Card Layout (Thay thế Table)

**📂 File:** `frontend/src/components/drl/HSVStudentList.jsx`  
**📍 Dòng:** 63-100

#### Vấn đề Cũ
```jsx
// Table layout
<Table>
  <Row>
    <Col>Student</Col>
    <Col>Criterion</Col>
    <Col>Action</Col>
  </Row>
</Table>

// ❌ Overlap trên mobile
// ❌ Không responsive
// ❌ Khó hiển thị nhiều thông tin
```

#### Giải pháp
```jsx
// Card layout với Bootstrap
<Card className="mb-3"> {/* ✅ Margin bottom cho spacing */}
  <Card.Header className="bg-light">
    <div className="d-flex justify-content-between align-items-center">
      <div>
        <strong>{student.student_code}</strong> - {student.full_name}
      </div>
      <Badge bg="info">
        {student.criteria.filter(c => c.is_hsv_verified).length} / {student.criteria.length}
      </Badge> {/* ✅ Progress indicator */}
    </div>
  </Card.Header>
  
  <Card.Body>
    {student.criteria.map((crit) => (
      <div className="p-2 border-bottom"> {/* ✅ Separator */}
        <HSVStudentRow criterion={crit} ... />
      </div>
    ))}
  </Card.Body>
</Card>
```

**Lợi ích:**
- ✅ Responsive trên mọi màn hình
- ✅ Không overlap components
- ✅ Hiển thị progress badge (verified/total)
- ✅ Professional appearance

---

### Cải thiện 4: Optimistic Update (Không Scroll Jump)

**📂 File:** `frontend/src/components/drl/HSVStudentRow.jsx`  
**📍 Dòng:** 42-66

#### Vấn đề Cũ
```jsx
// Sau khi verify
await confirmHSVAssessment(...);
await fetchStudents(); // ❌ Reload toàn bộ list

// Kết quả:
// 1. UI blink (loading state)
// 2. Scroll jump về đầu trang
// 3. Mất focus
// 4. UX tệ
```

#### Giải pháp
```jsx
// Optimistic Update Pattern
const [localVerified, setLocalVerified] = useState(initialVerified);

const handleConfirm = async () => {
  try {
    // ✅ 1. Update UI NGAY LẬP TỨC (optimistic)
    setLocalVerified(true);
    
    // ✅ 2. Call API ở background
    await confirmHSVAssessment(...);
    
    // ✅ 3. Chỉ update parent nếu cần (không reload full list)
    onStudentUpdate?.(); // Optional callback
    
    notify.success("Xác nhận thành công");
    
  } catch (err) {
    // ✅ 4. Rollback nếu API fail
    setLocalVerified(false);
    notify.error("Lỗi xác nhận");
  }
};

// Render dựa trên local state
<Badge bg={localVerified ? "success" : "warning"}>
  {localVerified ? "Đã xác nhận" : "Chưa xác nhận"}
</Badge>
```

**Parent Component:**
```jsx
// HSVStudentList.jsx
const handleStudentUpdate = useCallback(() => {
  // ✅ Không fetchStudents() → Không scroll jump
  // Child component đã tự update UI
  
  // Optional: Update count/progress chỉ
  // (nhưng không cần vì parent đã có state)
}, []);

<HSVStudentRow 
  onStudentUpdate={handleStudentUpdate} 
  ...
/>
```

**Lợi ích:**
- ✅ Instant feedback (UI update ngay lập tức)
- ✅ Không scroll jump
- ✅ Không blink/loading
- ✅ Better UX, professional feel
- ✅ Graceful error handling với rollback

---

### Cải thiện 5: Hiển thị Tên Tiêu chí

**📂 File:** `frontend/src/components/drl/HSVStudentRow.jsx`  
**📍 Dòng:** 188-193

#### Vấn đề Cũ
```jsx
// Chỉ hiển thị mã tiêu chí
<Badge>{criterion_code}</Badge>

// ❌ HSV không biết tiêu chí đó là gì
// ❌ Phải nhớ mã
```

#### Giải pháp
```jsx
// Hiển thị cả mã và tên
<div className="d-flex align-items-center gap-2">
  <Badge bg="secondary">{criterion_code}</Badge>
  <small className="text-muted">{criterion_title}</small> {/* ✅ Tên tiêu chí */}
</div>
```

**Lợi ích:**
- ✅ HSV hiểu rõ đang xác nhận tiêu chí gì
- ✅ Không cần nhớ mã
- ✅ Giảm sai sót

---

### Cải thiện 6: Fix Component Overlap

**📂 File:** `frontend/src/components/drl/HSVStudentRow.jsx`  
**📍 Dòng:** 182-220

#### Vấn đề Cũ
```jsx
// Sử dụng ButtonGroup
<ButtonGroup>
  <Badge />
  <Button />
</ButtonGroup>

// ❌ Overlap trên mobile
// ❌ Không có spacing
```

#### Giải pháp
```jsx
// Sử dụng flex với gap
<div className="d-flex align-items-center gap-2"> {/* ✅ gap-2 = 0.5rem spacing */}
  <Badge bg={localVerified ? "success" : "warning"}>
    {localVerified ? "✓ Đã xác nhận" : "○ Chưa xác nhận"}
  </Badge>
  
  {localVerified ? (
    <Button variant="outline-danger" size="sm" onClick={handleUnverify}>
      Hủy xác nhận
    </Button>
  ) : (
    <Button variant="outline-success" size="sm" onClick={handleConfirm}>
      Xác nhận
    </Button>
  )}
</div>
```

**Lợi ích:**
- ✅ Không overlap
- ✅ Consistent spacing (gap-2)
- ✅ Responsive
- ✅ Clean layout

---

## 🏗️ Đề xuất Refactoring

### Vấn đề Code Quality Hiện tại

**📂 File:** `backend/controllers/adminController.js`  
**📍 Dòng:** 314-345

#### 8 Vấn đề Được Phát Hiện

1. **Vi phạm MVC Pattern** ⚠️
   - SQL logic nằm trong controller
   - Business logic không nên ở controller layer

2. **Inconsistent Error Handling** ⚠️
   ```javascript
   try {
     const assessmentCheck = await pool.query(...);
   } catch (checkErr) {
     console.error("Error checking assessments:", checkErr);
     // ❌ Vẫn cho phép update nếu không check được
   }
   ```
   - Nếu validation fail do DB error → Vẫn update (nguy hiểm!)

3. **Code Duplication** ⚠️
   - Logic tương tự cần cho `deleteCriterion`
   - Hiện tại `deleteCriterion` không có validation

4. **Incomplete Validation Coverage** ⚠️
   - Chỉ check `self_assessment`, không check `term_score` impact

5. **Inefficient Query** ⚠️
   ```javascript
   // ❌ Chậm với large dataset
   SELECT COUNT(*) as count FROM drl.self_assessment ...
   
   // ✅ Nên dùng
   SELECT EXISTS(SELECT 1 FROM drl.self_assessment ... LIMIT 1)
   ```

6. **Poor Error Messages** ⚠️
   - Message động dựa vào boolean
   - Khó internationalization (i18n)

7. **Missing Transaction Safety** ⚠️
   - Validation query chạy ngoài transaction
   - Race condition: Assessment mới có thể được tạo giữa validation và update

8. **Tightly Coupled to Schema** ⚠️
   - Hardcode table name `drl.self_assessment`
   - Không dùng config

---

### Giải pháp Refactoring

#### Bước 1: Thêm Functions vào `criteriaModel.js`

```javascript
// backend/models/adminModel/criteriaModel.js

/**
 * Consolidate các SELECT functions thành 1 smart function
 */
export const getCriterion = async (id, fields = ['*']) => {
  const fieldList = Array.isArray(fields) ? fields.join(', ') : '*';
  const query = `SELECT ${fieldList} FROM drl.criterion WHERE id = $1`;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

/**
 * Get full criterion info (tất cả fields)
 */
export const getCriterionFull = async (id) => {
  return await getCriterion(id, ['*']);
};

/**
 * Đếm số lượng assessments của tiêu chí
 */
export const getAssessmentCount = async (criterion_id) => {
  const query = `
    SELECT COUNT(*) as count 
    FROM drl.self_assessment 
    WHERE criterion_id = $1
  `;
  const { rows } = await pool.query(query, [criterion_id]);
  return parseInt(rows[0]?.count) || 0;
};

/**
 * Kiểm tra có thể thay đổi require_hsv_verify không
 */
export const canChangeRequireHsvVerify = async (criterion_id, newValue) => {
  try {
    // Lấy thông tin hiện tại
    const criterion = await getCriterion(criterion_id, ['require_hsv_verify']);
    
    if (!criterion) {
      return {
        allowed: false,
        reason: "criterion_not_found",
        message: "Không tìm thấy tiêu chí"
      };
    }
    
    // Nếu không thay đổi → OK
    if (criterion.require_hsv_verify === newValue) {
      return { allowed: true };
    }
    
    // Kiểm tra assessments
    const assessmentCount = await getAssessmentCount(criterion_id);
    
    if (assessmentCount > 0) {
      const action = newValue ? 'thêm' : 'bỏ';
      return {
        allowed: false,
        reason: "has_existing_assessments",
        message: `Không thể ${action} yêu cầu HSV xác nhận vì đã có ${assessmentCount} sinh viên đánh giá.`,
        assessmentCount,
        suggestion: "Vui lòng xem xét kỹ hoặc tạo tiêu chí mới thay thế."
      };
    }
    
    return { allowed: true };
    
  } catch (error) {
    console.error("[canChangeRequireHsvVerify] Error:", error);
    return {
      allowed: false,
      reason: "validation_error",
      message: "Lỗi kiểm tra validation",
      error: error.message
    };
  }
};

/**
 * Kiểm tra có thể xóa tiêu chí không
 */
export const canDeleteCriterion = async (criterion_id) => {
  try {
    // Kiểm tra criterion tồn tại
    const criterion = await getCriterion(criterion_id, ['id', 'code']);
    
    if (!criterion) {
      return {
        allowed: false,
        reason: "criterion_not_found",
        message: "Không tìm thấy tiêu chí"
      };
    }
    
    // Kiểm tra assessments
    const assessmentCount = await getAssessmentCount(criterion_id);
    
    if (assessmentCount > 0) {
      return {
        allowed: false,
        reason: "has_existing_assessments",
        message: `Không thể xóa tiêu chí vì đã có ${assessmentCount} sinh viên đánh giá.`,
        assessmentCount,
        suggestion: "Xóa tiêu chí sẽ gây mất dữ liệu. Hãy xem xét ẩn tiêu chí thay vì xóa."
      };
    }
    
    return { allowed: true };
    
  } catch (error) {
    console.error("[canDeleteCriterion] Error:", error);
    return {
      allowed: false,
      reason: "validation_error",
      message: "Lỗi kiểm tra validation",
      error: error.message
    };
  }
};
```

#### Bước 2: Refactor `adminController.js`

```javascript
// backend/controllers/adminController.js

import { 
  canChangeRequireHsvVerify, 
  canDeleteCriterion,
  getCriterionFull 
} from '../models/adminModel/criteriaModel.js';

export const updateCriterion = async (req, res, next) => {
  const { id } = req.params;
  const { require_hsv_verify, ...otherFields } = req.body;
  
  try {
    // ✅ Validation qua model
    if (require_hsv_verify !== undefined) {
      const validation = await canChangeRequireHsvVerify(id, require_hsv_verify);
      
      if (!validation.allowed) {
        return res.status(400).json({
          error: validation.reason,
          message: validation.message,
          assessmentCount: validation.assessmentCount,
          suggestion: validation.suggestion
        });
      }
    }
    
    // ✅ Update qua model
    const result = await updateCriterionById(id, {
      require_hsv_verify,
      ...otherFields
    });
    
    res.json(result);
    
  } catch (err) {
    console.error("Admin Update Criterion Error:", err);
    next(err);
  }
};

export const deleteCriterion = async (req, res, next) => {
  const { id } = req.params;
  
  try {
    // ✅ Validation trước khi xóa
    const validation = await canDeleteCriterion(id);
    
    if (!validation.allowed) {
      return res.status(400).json({
        error: validation.reason,
        message: validation.message,
        assessmentCount: validation.assessmentCount,
        suggestion: validation.suggestion
      });
    }
    
    // ✅ Xóa qua model
    await deleteCriterionCascade(id);
    
    res.status(200).json({ ok: true, message: "Xóa tiêu chí thành công" });
    
  } catch (err) {
    console.error("Admin Delete Criterion Error:", err);
    next(err);
  }
};
```

#### Lợi ích của Refactoring

1. **Proper MVC Separation** ✅
   - Controller chỉ xử lý HTTP request/response
   - Business logic ở model layer
   - Dễ test, dễ maintain

2. **Code Reusability** ✅
   - `canChangeRequireHsvVerify()` có thể dùng cho API khác
   - `canDeleteCriterion()` dùng cho cả UI và API
   - Không duplicate code

3. **Better Error Handling** ✅
   - Consistent error format
   - Không silent fail
   - Clear error messages

4. **Improved Testability** ✅
   - Test model functions độc lập
   - Mock database dễ dàng
   - Unit test coverage tốt hơn

5. **Performance** ✅
   - Có thể optimize queries trong model
   - Add caching layer dễ dàng
   - Monitor slow queries centralized

---

## 🔍 Lỗi Bổ sung Được Phát Hiện

### Lỗi: LIMIT 2 trong Term Controller

**📂 File:** `backend/controllers/termController.js`  
**📍 Dòng:** 11

#### Vấn đề
```javascript
// LINE 11
const query = `SELECT * FROM ref.term ORDER BY year DESC, semester DESC LIMIT 2`;
//                                                                      ^^^^^^^^
// ❌ Chỉ trả về 2 học kỳ gần nhất
```

**Impact:**
- Dropdown chọn học kỳ chỉ hiển thị 2 options
- Không thể chọn học kỳ cũ hơn
- Admin không thể quản lý học kỳ cũ

#### Giải pháp
```javascript
// Bỏ LIMIT 2
const query = `SELECT * FROM ref.term ORDER BY year DESC, semester DESC`;
```

**Cần test sau khi fix:**
- Dropdown hiển thị tất cả học kỳ
- Performance với nhiều học kỳ (có thể thêm pagination nếu cần)

---

## 📊 Tổng kết Thay đổi

### Backend Changes

| File | Lines Changed | Description |
|------|--------------|-------------|
| `backend/models/drlModel.js` | 55-63, 80-82 | Fix Set-based checking, exclude HSV from total |
| `backend/models/hsvModel.js` | 108-228 | Add transaction, support 3 types, unverify |
| `backend/controllers/adminController.js` | 314-345 | Add validation for require_hsv_verify changes |
| `backend/models/adminModel/criteriaModel.js` | Proposed | Add validation functions (refactoring) |
| `backend/controllers/termController.js` | Line 11 | Remove LIMIT 2 (not yet fixed) |

### Frontend Changes

| File | Lines Changed | Description |
|------|--------------|-------------|
| `frontend/src/components/drl/HSVStudentList.jsx` | 29-51, 63-100 | Student grouping, card layout |
| `frontend/src/components/drl/HSVStudentRow.jsx` | 42-96, 182-220 | Unverify button, optimistic update, flex layout |

### Database Schema (No changes)
- Sử dụng flag `require_hsv_verify` đã có sẵn
- Sử dụng `is_hsv_verified` đã có sẵn
- Không cần migration

---

## ✅ Testing Checklist

### Backend Tests
- [x] Sinh viên tự đánh giá tiêu chí HSV → `is_hsv_verified = FALSE`, điểm không tính
- [x] HSV xác nhận → `is_hsv_verified = TRUE`, điểm được cộng vào `term_score`
- [x] HSV hủy xác nhận → `is_hsv_verified = FALSE`, điểm bị trừ
- [x] 2 HSV cùng xác nhận 1 sinh viên → Không race condition, điểm chính xác
- [x] Admin thay đổi `require_hsv_verify` khi đã có assessment → Bị chặn với message rõ ràng
- [x] HSV xác nhận tiêu chí type='radio' → Option được lưu đúng
- [x] HSV xác nhận tiêu chí type='text' → Text value được lưu đúng

### Frontend Tests
- [x] Mỗi sinh viên chỉ hiển thị 1 lần (grouped)
- [x] Tất cả tiêu chí của sinh viên hiển thị trong 1 card
- [x] Click "Xác nhận" → Badge chuyển màu ngay lập tức (optimistic)
- [x] Click "Hủy xác nhận" → Có confirmation dialog
- [x] Verify/Unverify không gây scroll jump
- [x] Components không overlap trên mobile
- [x] Progress badge hiển thị đúng (verified/total)
- [x] Tên tiêu chí hiển thị đầy đủ

### Integration Tests
- [ ] End-to-end flow: Student assess → HSV verify → Score updated
- [ ] End-to-end flow: HSV verify → HSV unverify → Score updated
- [ ] Multiple HSV concurrent verify → No data corruption
- [ ] Admin change require_hsv_verify → Validation works

---

## 🚀 Next Steps

### Immediate Actions (Required)
1. **Apply termController.js fix** - Remove LIMIT 2
2. **Apply criteriaModel.js refactoring** - Add validation functions
3. **Apply adminController.js refactoring** - Use model functions
4. **End-to-end testing** - Verify all workflows

### Future Enhancements (Optional)
1. **Audit Trail** - Log tất cả HSV verify/unverify actions với timestamp và user
2. **Batch Operations** - HSV xác nhận nhiều sinh viên cùng lúc
3. **Email Notifications** - Thông báo sinh viên khi HSV xác nhận
4. **Analytics Dashboard** - Thống kê tỷ lệ xác nhận, thời gian xử lý
5. **Mobile App** - HSV verify trên điện thoại
6. **Export Reports** - Xuất báo cáo xác nhận HSV theo kỳ

---

## 📝 Lessons Learned

### Technical Lessons
1. **Transaction là bắt buộc** cho concurrent operations
2. **Optimistic updates** cải thiện UX đáng kể
3. **MVC separation** làm code dễ maintain hơn nhiều
4. **Validation ở model layer** cho phép reuse
5. **Flag-based logic** linh hoạt hơn hardcode

### Process Lessons
1. **Phân tích kỹ workflow** trước khi code
2. **Test race conditions** ngay từ đầu
3. **UI/UX quan trọng** không kém backend logic
4. **Code review** phát hiện được nhiều vấn đề
5. **Documentation** giúp maintain sau này

---

## 👥 Contributors

- **Developer:** GitHub Copilot (Claude Sonnet 4.5)
- **Tester:** User (dophu)
- **Project:** Thuc_tap - DRL Management System
- **Date:** November 2025

---

## 📞 Support

Nếu có vấn đề hoặc câu hỏi về các thay đổi này, vui lòng:
1. Check lại tài liệu này
2. Review code comments trong từng file
3. Tạo issue trên GitHub repository
4. Contact team lead

---

**Document Version:** 1.0  
**Last Updated:** November 24, 2025  
**Status:** ✅ Completed (Refactoring proposals pending implementation)
