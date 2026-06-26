import { useNavigate } from 'react-router-dom'
import PlanList from './PlanList'

const TrainingPage = () => {
  const navigate = useNavigate()
  return (
    <PlanList
      onSelectPlan={(plan) => navigate(`/training/plan/${plan.id}`)}
      onNewPlan={() => navigate('/training/wizard')}
    />
  )
}

export default TrainingPage
