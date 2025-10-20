import { useNavigate } from 'react-router-dom';
import AdminPortal from '@/components/AdminPortal';

const AdminDashboard = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/app');
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminPortal onBack={handleBack} />
    </div>
  );
};

export default AdminDashboard;
