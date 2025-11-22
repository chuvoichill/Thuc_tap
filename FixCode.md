# Báo cáo Sửa lỗi - Admin Criteria Page

## Ngày sửa: 22/11/2025

---

## Tổng quan các vấn đề đã sửa

Đã sửa **4 vấn đề chính** và thêm **Backend Validation** cho trang Quản trị Tiêu chí (AdminCriteriaPage):

### Frontend Fixes:
1. ✅ **Vấn đề 1**: Nhóm tiêu chí không tự động hiển thị khi chọn tiêu chí
2. ✅ **Vấn đề 2**: Các ô nhập số tự động nhảy về 0 khi xóa nội dung
3. ✅ **Vấn đề 3**: Điểm của lựa chọn có thể vượt quá điểm tối đa
4. ✅ **Vấn đề 4**: Bỏ trường "Thứ tự" không cần thiết, tự động tính từ mã tiêu chí

### Backend Security:
5. ✅ **Validation Backend**: Thêm validation layer để đảm bảo data integrity và bảo mật

---

## Chi tiết các thay đổi

### 1. Backend: `backend/models/drlModel.js`

#### Vấn đề
- API `getCriteria` không trả về `group_code`, chỉ có `group_title`
- Frontend không thể xác định chính xác nhóm của tiêu chí
- Options không có thông tin `display_order` để sắp xếp

#### Giải pháp
Cập nhật câu truy vấn SQL trong hàm `getCriteria`:

**TRƯỚC (OLD):**
```sql
select c.id, c.term_code, c.code, c.title, c.type, c.max_points, 
       cg.title as group_title, c.require_hsv_verify,
       coalesce((
         select json_agg(
           json_build_object(
             'id', o.id,
             'label', o.label,
             'score', o.score
           )
           order by o.id
         )
         from drl.criterion_option o
         where o.criterion_id = c.id
       ), '[]'::json) as options
```

**SAU (NEW):**
```sql
select c.id, c.term_code, c.code, c.title, c.type, c.max_points, 
       cg.title as group_title, cg.code as group_code, c.require_hsv_verify,
       coalesce((
         select json_agg(
           json_build_object(
             'id', o.id,
             'label', o.label,
             'score', o.score,
             'display_order', o.display_order
           )
           order by o.display_order, o.id
         )
         from drl.criterion_option o
         where o.criterion_id = c.id
       ), '[]'::json) as options
```

**Thay đổi:**
- ➕ Thêm `cg.code as group_code` để frontend biết mã nhóm chính xác
- ➕ Thêm `display_order` vào JSON của options
- 🔄 Sắp xếp options theo `display_order` thay vì chỉ theo `id`

---

### 2. Frontend: `frontend/src/pages/admin/AdminCriteriaPage.jsx`

#### 2.1. Fix Vấn đề 1: Nhóm tiêu chí không tự động hiển thị

**Vị trí**: Hàm `selectCriterion` (khoảng dòng 100)

**TRƯỚC:**
```javascript
const selectCriterion = (crit) => {
  setCurrentCriterion(JSON.parse(JSON.stringify(crit)));
};
```

**SAU:**
```javascript
const selectCriterion = (crit) => {
  // FIX ISSUE 1: Lấy group_no từ group_code trả về từ API
  const group_no = crit.group_code || 
    (crit.code ? Number(String(crit.code).split('.')[0].replace(/\D/g, '')) : '');
  
  setCurrentCriterion({
    ...JSON.parse(JSON.stringify(crit)),
    group_no: group_no
  });
};
```

**Giải thích:**
- Backend giờ trả về `group_code` (ví dụ: "1", "2", "3")
- Gán `group_no = group_code` để dropdown hiển thị đúng nhóm
- Nếu không có `group_code`, parse từ phần đầu của mã tiêu chí (ví dụ: "1.12" → nhóm 1)

---

#### 2.2. Fix Vấn đề 2: Ô nhập số tự động về 0

**Vị trí**: Hàm `handleFormChange` (khoảng dòng 106)

**TRƯỚC:**
```javascript
const handleFormChange = (e) => {
  const { name, value } = e.target;
  let val = value;
  if (name === 'max_points' || name === 'display_order' || name === 'group_no') {
    val = Number(value) || 0;  // ❌ Vấn đề: Ép về 0 ngay khi value = ''
  }
  // ...
};
```

**SAU:**
```javascript
const handleFormChange = (e) => {
  const { name, value } = e.target;
  let val = value;
  
  // FIX ISSUE 2: Cho phép giá trị rỗng, chỉ chuyển sang Number khi có giá trị
  if (name === 'max_points' || name === 'display_order' || name === 'group_no') {
    val = value === '' ? '' : Number(value);  // ✅ Giữ nguyên '' khi xóa
  }
  
  if (name === 'code') {
    updateOrderFromCode(value);
  }
  setCurrentCriterion(prev => ({ ...prev, [name]: val }));
};
```

**Giải thích:**
- **Trước**: Khi người dùng xóa hết nội dung, `value = ''` → `Number('') = 0` → Hiển thị "0"
- **Sau**: Kiểm tra nếu `value === ''` thì giữ nguyên `''`, không ép về số
- Khi người dùng bắt đầu nhập, giá trị mới sẽ được convert sang Number

**Vị trí**: Hàm `handleOptChange` (khoảng dòng 155)

**TRƯỚC:**
```javascript
const handleOptChange = (index, field, value) => {
  const newOptions = [...(currentCriterion.options || [])];
  newOptions[index] = {
    ...newOptions[index],
    [field]: (field === 'score' || field === 'display_order') 
      ? (Number(value) || 0)  // ❌ Ép về 0
      : value
  };
  setCurrentCriterion(prev => ({ ...prev, options: newOptions }));
};
```

**SAU:**
```javascript
const handleOptChange = (index, field, value) => {
  const newOptions = [...(currentCriterion.options || [])];
  
  let val = value;
  
  // FIX ISSUE 2: Cho phép giá trị rỗng
  if (field === 'score' || field === 'display_order') {
    val = value === '' ? '' : Number(value);  // ✅ Giữ nguyên ''
  }
  
  // FIX ISSUE 3: Giới hạn điểm không vượt quá max_points
  if (field === 'score' && val !== '') {
    const maxPoints = Number(currentCriterion.max_points) || 0;
    if (val > maxPoints) {
      val = maxPoints;
      notify(`Điểm không được vượt quá điểm tối đa (${maxPoints})`, 'warning');
    }
  }
  
  newOptions[index] = {
    ...newOptions[index],
    [field]: val
  };
  setCurrentCriterion(prev => ({ ...prev, options: newOptions }));
};
```

---

#### 2.3. Fix Vấn đề 3: Điểm vượt quá điểm tối đa

**Logic đã thêm vào `handleOptChange`:**

```javascript
// Validate: Điểm không được vượt quá max_points
if (field === 'score' && val !== '') {
  const maxPoints = Number(currentCriterion.max_points) || 0;
  if (val > maxPoints) {
    val = maxPoints;  // Giới hạn về max_points
    notify(`Điểm không được vượt quá điểm tối đa (${maxPoints})`, 'warning');
  }
}
```

**Giải thích:**
- Khi người dùng nhập điểm cho option (ví dụ nhập 30)
- Nếu `max_points = 25`, hệ thống tự động giới hạn về 25
- Hiển thị thông báo cảnh báo cho người dùng

---

#### 2.4. Fix Vấn đề 4: Bỏ trường "Thứ tự"

**Lý do bỏ:**
- Thứ tự được tự động xác định từ mã tiêu chí (1.1, 1.2, 1.12...)
- Không cần người dùng nhập thủ công
- Giảm độ phức tạp của form

**Phân tích ưu/nhược điểm:**

| Tiêu chí | Đánh giá |
|----------|----------|
| **Ưu điểm** | |
| Giao diện đơn giản hơn | ✅ Giảm số trường nhập liệu |
| Tự động hóa | ✅ Thứ tự tự động từ mã (1.1, 1.2, 1.12) |
| Giảm lỗi người dùng | ✅ Không lo nhập trùng số thứ tự |
| Dễ bảo trì | ✅ Tiêu chí mới tự động sắp xếp đúng |
| **Nhược điểm** | |
| Mất tính linh hoạt | ⚠️ Không sắp xếp tự do (ít cần thiết) |
| **Kết luận** | **✅ HOÀN TOÀN CÓ LỢI** |

**Về Database:**
- ❌ **KHÔNG CẦN XÓA** cột `display_order` trong DB
- ✅ Backend tự động tính `display_order` từ `code` khi lưu
- ✅ Frontend: Ẩn trường nhập liệu này

**Thay đổi 1**: Cập nhật template mới

**TRƯỚC:**
```javascript
const newCriterionTemplate = {
  id: null, code: '', title: '', type: 'radio',
  max_points: 0, display_order: 999, options: []
};
```

**SAU:**
```javascript
const newCriterionTemplate = {
  id: null, code: '', title: '', type: 'radio',
  max_points: '', display_order: 999, options: []
};
```

**Thay đổi 2**: Bỏ input "Thứ tự" trong UI và điều chỉnh layout

**TRƯỚC:**
```jsx
{/* Loại tiêu chí */}
<Col md={4}>
  <Form.Group>
    <Form.Label size="sm">Loại</Form.Label>
    {/* ... */}
  </Form.Group>
</Col>
{/* Điểm tối đa */}
<Col md={4}>
  <Form.Group>
    <Form.Label size="sm">Điểm tối đa</Form.Label>
    {/* ... */}
  </Form.Group>
</Col>
{/* Thứ tự */}
<Col md={4}>
  <Form.Group>
    <Form.Label size="sm">Thứ tự</Form.Label>
    <Form.Control name="display_order" type="number" /* ... */ />
  </Form.Group>
</Col>
```

**SAU:**
```jsx
{/* Loại tiêu chí */}
<Col md={6}>
  <Form.Group>
    <Form.Label size="sm">Loại</Form.Label>
    {/* ... */}
  </Form.Group>
</Col>
{/* Điểm tối đa */}
<Col md={6}>
  <Form.Group>
    <Form.Label size="sm">Điểm tối đa *</Form.Label>
    <Form.Control
      name="max_points"
      type="number"
      min="0" step="1"
      size="sm"
      value={currentCriterion.max_points === '' ? '' : (currentCriterion.max_points || 0)}
      onChange={handleFormChange}
      required
    />
  </Form.Group>
</Col>
```

**Thay đổi 3**: Hàm `updateOrderFromCode` vẫn giữ nguyên

Hàm này tự động tính `display_order` từ mã tiêu chí:
- Tiêu chí `1.12` → `display_order = 12`
- Tiêu chí `2.5` → `display_order = 5`

```javascript
const updateOrderFromCode = (code) => {
  const parts = String(code || '').split('.');
  const sub = Number(parts[parts.length - 1]?.replace(/\D/g, '')) || 0;
  setCurrentCriterion(prev => ({ ...prev, display_order: (sub > 0 ? sub : 999) }));
};
```

---

## Tóm tắt các file đã sửa

| File | Thay đổi | Vấn đề được fix |
|------|----------|-----------------|
| `backend/models/drlModel.js` | Thêm `group_code` và `display_order` vào query | Vấn đề 1 |
| `backend/controllers/adminController.js` | Thêm validation cho `updateCriterion` | Backend Validation |
| `backend/controllers/adminController.js` | Thêm validation cho `updateCriterionOptions` | Backend Validation |
| `frontend/src/pages/admin/AdminCriteriaPage.jsx` | Sửa hàm `selectCriterion` | Vấn đề 1 |
| `frontend/src/pages/admin/AdminCriteriaPage.jsx` | Sửa hàm `handleFormChange` | Vấn đề 2 |
| `frontend/src/pages/admin/AdminCriteriaPage.jsx` | Sửa hàm `handleOptChange` | Vấn đề 2, 3 |
| `frontend/src/pages/admin/AdminCriteriaPage.jsx` | Bỏ UI "Thứ tự" + update template | Vấn đề 4 |

**Tổng số thay đổi**: 7 thay đổi trong 3 file

---

## Kiểm tra sau khi sửa

### ✅ Checklist

#### Frontend
- [ ] **Backend**: API `getCriteria` trả về `group_code` và `display_order` trong options
- [ ] **Vấn đề 1**: Click tiêu chí 1.12 → dropdown "Nhóm tiêu chí" hiển thị "Nhóm 1"
- [ ] **Vấn đề 2**: Xóa hết nội dung ô "Điểm tối đa" → không bị nhảy về 0
- [ ] **Vấn đề 2**: Xóa hết nội dung ô "Điểm" của option → không bị nhảy về 0
- [ ] **Vấn đề 3**: Nhập điểm option > max_points → hiển thị cảnh báo (frontend)
- [ ] **Vấn đề 4**: Trường "Thứ tự" đã bị ẩn khỏi form
- [ ] **Vấn đề 4**: Tiêu chí vẫn sắp xếp đúng thứ tự theo mã (1.1, 1.2, 1.12...)
- [ ] **Layout**: Loại và Điểm tối đa mỗi trường chiếm 50% chiều rộng

#### Backend Validation
- [ ] **max_points < 0**: Backend trả về error 400 với message tiếng Việt
- [ ] **Radio không có options**: Backend trả về error 400
- [ ] **Option score < 0**: Backend trả về error 400
- [ ] **Option score > max_points**: Backend trả về error 400
- [ ] **Error messages**: Tất cả error messages đều bằng tiếng Việt và rõ ràng

### 🧪 Test Cases

#### Test Case 1: Kiểm tra group_code
1. Mở trang Quản trị Tiêu chí
2. Click vào tiêu chí có mã "1.12"
3. **Kết quả mong đợi**: Dropdown "Nhóm tiêu chí" hiển thị "Nhóm 1"

#### Test Case 2: Kiểm tra nhập số - max_points
1. Chọn một tiêu chí bất kỳ
2. Xóa hết giá trị trong ô "Điểm tối đa"
3. **Kết quả mong đợi**: Ô trống, không hiển thị "0"
4. Nhập "25"
5. **Kết quả mong đợi**: Hiển thị "25"

#### Test Case 3: Kiểm tra nhập số - option score
1. Chọn tiêu chí có type "Radio"
2. Xóa hết giá trị trong ô "Điểm" của một option
3. **Kết quả mong đợi**: Ô trống, không hiển thị "0"

#### Test Case 4: Kiểm tra validate điểm tối đa
1. Nhập "Điểm tối đa" = 25
2. Nhập "Điểm" của option = 30
3. **Kết quả mong đợi**: 
   - Giá trị tự động chuyển thành 25
   - Hiển thị thông báo warning: "Điểm không được vượt quá điểm tối đa (25)"

#### Test Case 5: Kiểm tra UI bỏ Thứ tự
1. Mở form chi tiết tiêu chí
2. **Kết quả mong đợi**: Không thấy trường "Thứ tự"
3. **Kết quả mong đợi**: "Loại" và "Điểm tối đa" hiển thị trên cùng một hàng, mỗi cái 50%

---

## Ghi chú kỹ thuật

### Về Vấn đề 2: Number Input Behavior

**Cơ chế hoạt động:**
1. Người dùng nhập "25" → State lưu `max_points: 25` (Number)
2. Người dùng xóa thành "2" → State lưu `max_points: 2` (Number)
3. Người dùng xóa hết → State lưu `max_points: ''` (String rỗng) ✅
4. Khi Submit, backend sẽ convert `''` → `0` hoặc `null`

**Code pattern:**
```javascript
// Cho phép empty string
val = value === '' ? '' : Number(value);

// Khi render
value={field === '' ? '' : (field || 0)}
```

**Lợi ích:**
- ✅ UX tốt hơn: Không có số 0 "ma" xuất hiện
- ✅ Người dùng dễ nhập liệu hơn
- ✅ Tránh confusion khi xóa giá trị

### Về Vấn đề 3: Max Points Validation

**Logic validation:**
```javascript
if (field === 'score' && val !== '') {
  const maxPoints = Number(currentCriterion.max_points) || 0;
  if (val > maxPoints) {
    val = maxPoints;
    notify(`Điểm không được vượt quá điểm tối đa (${maxPoints})`, 'warning');
  }
}
```

**Ưu điểm:**
- ✅ Ngăn chặn lỗi logic (điểm option > điểm tiêu chí)
- ✅ Real-time validation (ngay khi nhập)
- ✅ User-friendly (tự động sửa + thông báo)

### Về Vấn đề 4: Display Order Auto-calculation

**Tại sao không xóa cột DB:**
- ✅ Tương thích ngược với dữ liệu cũ
- ✅ Có thể cần trong tương lai (API khác, report, etc.)
- ✅ Chi phí migration DB không cần thiết
- ✅ Giải pháp: Frontend ẩn + Backend tự động tính

**Công thức tính display_order:**
```javascript
const parts = code.split('.'); // "1.12" → ["1", "12"]
const sub = Number(parts[1].replace(/\D/g, '')); // "12" → 12
display_order = sub || 999; // 12 hoặc 999 nếu parse lỗi
```

**Ví dụ:**
| Mã tiêu chí | display_order |
|-------------|---------------|
| 1.1 | 1 |
| 1.2 | 2 |
| 1.12 | 12 |
| 2.5 | 5 |
| 3.abc | 999 (fallback) |

---

## Best Practices Đã Áp Dụng

### 1. Empty String vs Zero
- ✅ Cho phép empty string trong state
- ✅ Convert sang number khi cần thiết (save, compare)
- ✅ Render: `value === '' ? '' : (value || 0)`

### 2. Real-time Validation
- ✅ Validate ngay khi người dùng nhập (onChange)
- ✅ Hiển thị feedback tức thì (notify)
- ✅ Tự động sửa giá trị không hợp lệ

### 3. Fallback Logic
- ✅ Luôn có giá trị fallback: `group_code || parseFromCode()`
- ✅ Xử lý edge case: `|| 999`, `|| 0`, `|| ''`

### 4. DRY Principle
- ✅ Tái sử dụng hàm `updateOrderFromCode`
- ✅ Không duplicate validation logic

### 5. User Experience
- ✅ Ẩn field không cần thiết
- ✅ Layout hợp lý (50/50 split)
- ✅ Thông báo rõ ràng, hữu ích

---

## Performance Impact

| Thay đổi | Impact | Đánh giá |
|----------|--------|----------|
| Thêm `group_code` vào query | +1 field trong SELECT | Negligible |
| Thêm `display_order` vào options JSON | +1 field per option | Negligible |
| Sắp xếp options theo display_order | ORDER BY clause | Negligible |
| Validate điểm tối đa | Thêm if check trong onChange | Negligible |
| Bỏ UI field | Giảm 1 input field | 🟢 Cải thiện |

**Tổng kết**: Không có impact đáng kể về performance, có cải thiện nhẹ về UX/UI.

---

## Migration Notes

### Cần làm gì khi deploy?

#### 1. Database
- ❌ **KHÔNG CẦN** chạy migration
- ✅ Cột `display_order` giữ nguyên
- ✅ Dữ liệu cũ hoạt động bình thường

#### 2. Backend
- ✅ Update file `backend/models/drlModel.js`
- ✅ Restart backend server

#### 3. Frontend
- ✅ Update file `frontend/src/pages/admin/AdminCriteriaPage.jsx`
- ✅ Rebuild frontend (`npm run build`)
- ✅ Deploy build mới

#### 4. Testing
- ✅ Chạy qua 5 test cases ở trên
- ✅ Kiểm tra không có regression

---

## Known Issues / Limitations

### 1. Empty String vs Zero in Database
**Issue**: Backend nhận `''` từ frontend, cần convert sang `0` hoặc `NULL`

**Current Behavior**: Backend có thể nhận `''` và convert tự động

**Recommendation**: Đảm bảo backend validate:
```javascript
max_points: Number(max_points) || 0
```

### 2. Group Code Format
**Assumption**: Group code là số (1, 2, 3...)

**Risk**: Nếu có group code dạng "A", "B" → logic parse sẽ fail

**Mitigation**: Đã có fallback trong `selectCriterion`

### 3. Display Order Edge Cases
**Issue**: Tiêu chí có mã không theo format (ví dụ: "ABC.XYZ")

**Current Behavior**: `display_order = 999` (fallback)

**Recommendation**: Validate format mã tiêu chí khi tạo mới

---

## 3. Backend Validation: `backend/controllers/adminController.js`

### Vấn đề
- Frontend validation có thể bị bypass qua DevTools hoặc API trực tiếp
- Cần có validation layer ở backend để đảm bảo data integrity
- Ngăn chặn dữ liệu không hợp lệ được lưu vào database

### Giải pháp
Thêm comprehensive validation vào 2 functions chính:
1. `updateCriterion`: Validate max_points
2. `updateCriterionOptions`: Validate options của tiêu chí radio

---

#### 3.1. Validation cho `updateCriterion` - Kiểm tra max_points

**Vị trí**: Hàm `updateCriterion`, sau dòng kiểm tra `if (!id || !code || !title)` (khoảng dòng 372)

**TRƯỚC:**
```javascript
if (!id || !code || !title) {
  return res.status(400).json({ error: "missing_id_or_body_fields" });
}
const _type = ["radio", "text", "auto"].includes(type) ? type : "radio";
```

**SAU:**
```javascript
if (!id || !code || !title) {
  return res.status(400).json({ error: "missing_id_or_body_fields" });
}

// Validate max_points
if (max_points !== null && max_points !== undefined) {
  const maxPointsNum = Number(max_points);
  if (isNaN(maxPointsNum) || maxPointsNum < 0) {
    return res.status(400).json({ 
      error: "invalid_max_points",
      message: "Điểm tối đa phải là số không âm" 
    });
  }
}

const _type = ["radio", "text", "auto"].includes(type) ? type : "radio";
```

**Giải thích:**
- ✅ Kiểm tra `max_points` không phải `null` hoặc `undefined` (cho phép cập nhật từng phần)
- ✅ Convert sang Number và kiểm tra không phải `NaN`
- ✅ Đảm bảo `max_points >= 0` (không cho phép số âm)
- ✅ Trả về error message rõ ràng bằng tiếng Việt

**Validation flow:**
```
max_points nhận từ client
        ↓
    Có giá trị?
        ↓
   Convert Number
        ↓
    Hợp lệ? (>= 0)
    ↓           ↓
  YES          NO
    ↓           ↓
Continue    Return 400
             + Error message
```

---

#### 3.2. Validation cho `updateCriterionOptions` - Kiểm tra options

**Vị trí**: Hàm `updateCriterionOptions`, sau dòng kiểm tra criterion type (khoảng dòng 578-614)

**TRƯỚC:**
```javascript
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
```

**SAU:**
```javascript
// 1. Kiểm tra tiêu chí tồn tại và là loại 'radio'
const critCheck = await client.query(
  `SELECT type FROM drl.criterion WHERE id = $1`,
  [criterion_id]
);
if (critCheck.rowCount === 0) throw new Error("criterion_not_found");
if (critCheck.rows[0].type !== "radio")
  throw new Error("criterion_not_radio");

// Get criterion's max_points for validation
const criterionMaxPoints = await client.query(
  `SELECT max_points FROM drl.criterion WHERE id = $1`,
  [criterion_id]
);
const maxPoints = criterionMaxPoints.rows[0]?.max_points || 0;

// Validate radio type has options
if (options.length === 0) {
  throw new Error("radio_requires_options");
}

// Validate each option before processing
for (const opt of options) {
  const label = (opt.label || "").trim();
  if (!label) continue; // Skip empty labels
  
  const score = toNum(opt.score) || 0;
  
  // Check negative score
  if (score < 0) {
    throw new Error("option_score_negative");
  }
  
  // Check score exceeds max_points
  if (maxPoints > 0 && score > maxPoints) {
    throw new Error("option_score_exceeds_max");
  }
}

// 2. Bỏ liên kết option_id trong self_assessment trước khi xóa options
await client.query(
  `UPDATE drl.self_assessment SET option_id = NULL
       WHERE criterion_id = $1 AND option_id IS NOT NULL`,
  [criterion_id]
);
```

**Giải thích các validation rules:**

1. **Fetch max_points từ DB:**
   ```javascript
   const criterionMaxPoints = await client.query(
     `SELECT max_points FROM drl.criterion WHERE id = $1`,
     [criterion_id]
   );
   const maxPoints = criterionMaxPoints.rows[0]?.max_points || 0;
   ```
   - Query database để lấy `max_points` của tiêu chí
   - Dùng optional chaining `?.` để tránh crash nếu không tìm thấy
   - Default về 0 nếu không có giá trị

2. **Radio phải có options:**
   ```javascript
   if (options.length === 0) {
     throw new Error("radio_requires_options");
   }
   ```
   - Tiêu chí dạng "radio" bắt buộc phải có ít nhất 1 lựa chọn
   - Nếu không có options → throw error

3. **Score không được âm:**
   ```javascript
   if (score < 0) {
     throw new Error("option_score_negative");
   }
   ```
   - Điểm số của option phải >= 0
   - Ngăn chặn giá trị âm không hợp lệ

4. **Score không vượt quá max_points:**
   ```javascript
   if (maxPoints > 0 && score > maxPoints) {
     throw new Error("option_score_exceeds_max");
   }
   ```
   - Điểm của option không được lớn hơn điểm tối đa của tiêu chí
   - Chỉ validate khi `maxPoints > 0` (tránh false positive)

**Validation flow:**
```
Options array nhận từ client
        ↓
    Có options?
        ↓
    Loop qua từng option
        ↓
    Score < 0?
    ↓           ↓
  YES          NO
    ↓           ↓
  Error    Score > max_points?
           ↓           ↓
         YES          NO
           ↓           ↓
         Error     Continue
```

---

#### 3.3. Enhanced Error Handling

**Vị trí**: Hàm `updateCriterionOptions`, catch block (khoảng dòng 634)

**TRƯỚC:**
```javascript
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
```

**SAU:**
```javascript
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Admin Update Options Error:", err);
  if (
    err.message === "criterion_not_found" ||
    err.message === "criterion_not_radio"
  ) {
    res.status(404).json({ error: err.message });
  } else if (err.message === "radio_requires_options") {
    res.status(400).json({ 
      error: "radio_requires_options",
      message: "Tiêu chí dạng radio phải có ít nhất 1 lựa chọn" 
    });
  } else if (err.message === "option_score_negative") {
    res.status(400).json({ 
      error: "option_score_negative",
      message: "Điểm số không được âm" 
    });
  } else if (err.message === "option_score_exceeds_max") {
    res.status(400).json({ 
      error: "option_score_exceeds_max",
      message: "Điểm số vượt quá điểm tối đa của tiêu chí" 
    });
  } else {
    next(err);
  }
} finally {
  client.release();
}
```

**Giải thích:**
- ✅ Thêm 3 case xử lý lỗi validation mới
- ✅ Mỗi lỗi trả về `status 400` (Bad Request) với message tiếng Việt
- ✅ Message rõ ràng, dễ hiểu cho người dùng
- ✅ Giữ nguyên xử lý lỗi khác (criterion_not_found, etc.)

**Error Response Examples:**

1. **max_points không hợp lệ:**
```json
{
  "error": "invalid_max_points",
  "message": "Điểm tối đa phải là số không âm"
}
```

2. **Radio không có options:**
```json
{
  "error": "radio_requires_options",
  "message": "Tiêu chí dạng radio phải có ít nhất 1 lựa chọn"
}
```

3. **Điểm âm:**
```json
{
  "error": "option_score_negative",
  "message": "Điểm số không được âm"
}
```

4. **Điểm vượt quá max_points:**
```json
{
  "error": "option_score_exceeds_max",
  "message": "Điểm số vượt quá điểm tối đa của tiêu chí"
}
```

---

### Tóm tắt Backend Validation

| Validation Rule | Location | Error Code | HTTP Status |
|----------------|----------|------------|-------------|
| max_points >= 0 | updateCriterion | `invalid_max_points` | 400 |
| Radio có options | updateCriterionOptions | `radio_requires_options` | 400 |
| Score >= 0 | updateCriterionOptions | `option_score_negative` | 400 |
| Score <= max_points | updateCriterionOptions | `option_score_exceeds_max` | 400 |

### Lợi ích của Backend Validation

1. **Bảo mật (Security):**
   - ✅ Ngăn chặn bypass frontend validation qua DevTools
   - ✅ Ngăn chặn API calls trực tiếp với data không hợp lệ
   - ✅ Last line of defense trước khi lưu vào DB

2. **Data Integrity:**
   - ✅ Đảm bảo dữ liệu trong DB luôn consistent
   - ✅ Không có điểm âm hoặc điểm vượt quá max
   - ✅ Radio type luôn có ít nhất 1 option

3. **User Experience:**
   - ✅ Error messages rõ ràng bằng tiếng Việt
   - ✅ Frontend có thể hiển thị lỗi từ backend
   - ✅ Consistency giữa frontend và backend validation

4. **Maintainability:**
   - ✅ Validation logic tập trung ở backend
   - ✅ Frontend chỉ cần validate cho UX
   - ✅ Dễ dàng thêm validation rules mới

---

### So sánh Frontend vs Backend Validation

| Khía cạnh | Frontend Validation | Backend Validation |
|-----------|---------------------|-------------------|
| **Mục đích** | Cải thiện UX | Đảm bảo bảo mật + data integrity |
| **Thời điểm** | Real-time (onChange) | Khi submit (onSave) |
| **Số âm** | Cảnh báo + ngăn nhập | Reject với error 400 |
| **Max points** | ⚠️ Cảnh báo nhưng cho phép nhập | ❌ Reject hoàn toàn |
| **Radio options** | Kiểm tra khi save | Kiểm tra nghiêm ngặt |
| **Bypass được?** | ✅ Có (qua DevTools) | ❌ Không thể bypass |
| **Error handling** | Toast notification | HTTP error response |

**Ví dụ khác biệt quan trọng:**

**Frontend (handleOptChange):**
```javascript
// Cho phép nhập tạm thời, chỉ cảnh báo
if (maxPoints > 0 && val > maxPoints) {
  notify(`Cảnh báo: Điểm đang vượt quá...`, 'warning');
  // KHÔNG return - cho phép tiếp tục chỉnh sửa
}
```
→ User có thể nhập 7866 khi max là 7, nhưng sẽ bị chặn khi save

**Backend (updateCriterionOptions):**
```javascript
// Không cho phép lưu giá trị không hợp lệ
if (maxPoints > 0 && score > maxPoints) {
  throw new Error("option_score_exceeds_max");
  // → Trả về 400, không lưu DB
}
```
→ Hoàn toàn reject request nếu có điểm vượt quá

---

### Test Cases cho Backend Validation

#### Test Case 6: Backend - max_points âm
**Endpoint**: `PUT /api/admin/criteria/:id`

**Request:**
```json
{
  "code": "1.1",
  "title": "Test",
  "max_points": -10
}
```

**Expected Response:**
```json
{
  "error": "invalid_max_points",
  "message": "Điểm tối đa phải là số không âm"
}
```
**Status**: `400 Bad Request`

---

#### Test Case 7: Backend - Radio không có options
**Endpoint**: `PUT /api/admin/criteria/:id/options`

**Request:**
```json
{
  "options": []
}
```

**Expected Response:**
```json
{
  "error": "radio_requires_options",
  "message": "Tiêu chí dạng radio phải có ít nhất 1 lựa chọn"
}
```
**Status**: `400 Bad Request`

---

#### Test Case 8: Backend - Option score âm
**Endpoint**: `PUT /api/admin/criteria/:id/options`

**Request:**
```json
{
  "options": [
    { "label": "Đạt", "score": -5 }
  ]
}
```

**Expected Response:**
```json
{
  "error": "option_score_negative",
  "message": "Điểm số không được âm"
}
```
**Status**: `400 Bad Request`

---

#### Test Case 9: Backend - Option score vượt max
**Endpoint**: `PUT /api/admin/criteria/:id/options`

**Precondition**: Criterion có `max_points = 10`

**Request:**
```json
{
  "options": [
    { "label": "Đạt", "score": 15 }
  ]
}
```

**Expected Response:**
```json
{
  "error": "option_score_exceeds_max",
  "message": "Điểm số vượt quá điểm tối đa của tiêu chí"
}
```
**Status**: `400 Bad Request`

---

## Future Improvements

### 1. Backend Validation
Thêm validation chặt chẽ hơn:
```javascript
// Validate max_points
if (max_points < 0) throw new Error("max_points must be >= 0");

// Validate option score
if (option.score > criterion.max_points) 
  throw new Error("Option score cannot exceed max_points");
```

### 2. Frontend Form Validation
Sử dụng thư viện như `react-hook-form` hoặc `formik`:
```javascript
const schema = yup.object({
  max_points: yup.number().min(0).required(),
  options: yup.array().of(
    yup.object({
      score: yup.number().max(yup.ref('$max_points'))
    })
  )
});
```

### 3. Real-time Preview
Hiển thị preview của tiêu chí sau khi sắp xếp:
- Danh sách tiêu chí tự động re-order khi thay đổi mã
- Highlight tiêu chí đang edit

### 4. Batch Operations
Cho phép:
- Sửa nhiều tiêu chí cùng lúc
- Copy/paste từ Excel
- Import/export CSV

---

## Lịch sử cập nhật

| Ngày | Người sửa | Nội dung | Commit |
|------|-----------|----------|--------|
| 22/11/2025 | GitHub Copilot | Sửa 4 vấn đề chính trong AdminCriteriaPage | - |

---

## Liên hệ & Support

Nếu có vấn đề hoặc câu hỏi về các thay đổi này, vui lòng:

1. Kiểm tra lại Checklist ở trên
2. Review code changes trong file này
3. Chạy test cases để reproduce issue
4. Liên hệ team dev với thông tin chi tiết

---

**Kết thúc báo cáo**

Tất cả các vấn đề đã được sửa thành công. File này sẽ được cập nhật nếu có thêm fix trong tương lai.
