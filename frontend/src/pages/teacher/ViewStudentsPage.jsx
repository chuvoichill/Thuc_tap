import { useTerm } from '../../layout/DashboardLayout';
import ClassStudentList from '../../components/drl/ClassStudentList';

export default function ViewStudentsPage() {
  const { term } = useTerm(); 

  return (
        <ClassStudentList term={term} />
  );
}
