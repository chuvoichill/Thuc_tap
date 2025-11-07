import FacultyClassList from "../../components/drl/FacultyClassList";

const ViewClassesPage = () => {
  // Với tài khoản khoa, FacultyClassList sẽ tự gọi getFacultyClasses(user.username, term)
  return <FacultyClassList />;
}
export default ViewClassesPage;
