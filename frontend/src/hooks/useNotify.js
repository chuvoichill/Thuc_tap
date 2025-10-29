import { useContext } from 'react';
import NotifyContext from '../context/NotifyContext';

const useNotify = () => {
  return useContext(NotifyContext);
};

export default useNotify;