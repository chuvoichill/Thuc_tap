import FacultyClassList from "../../components/drl/FacultyClassList";
import { useState } from "react";

const ViewClassesPage = () => {
  const [faculty, setFaculty] = useState(null);
  // Với tài khoản khoa, FacultyClassList sẽ tự gọi getFacultyClasses(user.username, term)
  return (
    <>
      <div className='section-title mb-3 px-3'>
        <strong>Danh sách khoa {faculty}</strong>
      </div>
      <FacultyClassList setFaculty={setFaculty} />
    </>
  );
}
export default ViewClassesPage;
