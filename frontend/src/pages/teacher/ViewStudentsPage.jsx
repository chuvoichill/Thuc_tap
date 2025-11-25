import { useTerm } from '../../layout/DashboardLayout';
import ClassStudentList from '../../components/drl/ClassStudentList';
import { Button, ButtonGroup, FormCheck, Container } from 'react-bootstrap';
import { useState } from 'react';

export default function ViewStudentsPage() {
  const { term } = useTerm();
  const [selectedStudentList, setSelectedStudentList] = useState(true);

  return (
    <>
      <Container className="d-grid justify-content-center align-items-center">
        <ButtonGroup className="mb-2 ">
          <Button variant={selectedStudentList ? "success" : "outline-success"} onClick={() => setSelectedStudentList(true)}>Sinh viên đã đánh giá</Button>
          <Button variant={selectedStudentList ? "outline-success" : "success"} onClick={() => setSelectedStudentList(false)}>Sinh viên chưa đánh giá</Button>
        </ButtonGroup>
        <Container className={selectedStudentList ? "d-none" : "d-grid justify-content-center align-items-center"}>
          <FormCheck label="Cho tất cả 0đ" className='mb-2'></FormCheck>
          <Button variant="success" className='btn-main mb-2'>Xác nhận</Button>
        </Container>

      </Container>

      <ClassStudentList term={term} />
    </>

  );
}
