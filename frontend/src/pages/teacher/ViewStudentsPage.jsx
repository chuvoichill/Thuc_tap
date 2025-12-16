import { useTerm } from '../../layout/DashboardLayout';
import ClassStudentList from '../../components/drl/ClassStudentList';
import { Button, ButtonGroup, FormCheck, Container } from 'react-bootstrap';
import { useState, useCallback } from 'react';

export default function ViewStudentsPage() {
  const { term } = useTerm();
  const [classCode, setClassCode] = useState(null);
  const [selectedStudentList, setSelectedStudentList] = useState(true);
  const [select,setSelect] =useState(false)
  const [checkBox, setCheckBox] =useState(false)
  const resetSl = useCallback(() => {
    setSelect(false);
  }, []);

  return (
    <>
      <Container className="d-grid justify-content-center align-items-center">
        <ButtonGroup className="mb-2 ">
          <Button variant={selectedStudentList ? "success" : "outline-success"} onClick={() => setSelectedStudentList(true)}>Sinh viên đã đánh giá</Button>
          <Button variant={selectedStudentList ? "outline-success" : "success"} onClick={() => setSelectedStudentList(false)}>Sinh viên chưa đánh giá</Button>
        </ButtonGroup>
        <Container className={selectedStudentList ? "d-none" : "d-grid justify-content-center align-items-center"}>
          <FormCheck label="Cho tất cả 0đ" className='mb-2 customCheck' onClick={()=>checkBox?setCheckBox(false):setCheckBox(true)}></FormCheck>
          <Button variant="success" className='btn-main mb-2' onClick={()=>checkBox?setSelect(true):setSelect(false)}>Xác nhận</Button>
        </Container>
      </Container>

      <div className='section-title mb-3 px-3'>
        
        <strong>Danh sách sinh viên lớp {classCode}</strong>
      </div>
      
      <ClassStudentList term={term} isRated={selectedStudentList} select={select} resetSl={resetSl} setClassCode={setClassCode} page="teacher" />
    </>

  );
}
