import { useNavigate } from 'react-router-dom';
import BrokerPortal from '@/components/BrokerPortal';

const BrokerDashboard = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <BrokerPortal onBack={handleBack} />
    </div>
  );
};

export default BrokerDashboard;
