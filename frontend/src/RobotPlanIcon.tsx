import { Bitcoin, Blocks, Bot, ChartCandlestick, ChartLine, CircuitBoard, Coins, Cpu, Gem, Network, Radar } from 'lucide-react'

// Decorative visuals only; these do not identify an actual traded asset or integration.
const planIcons = [Bitcoin, ChartCandlestick, Coins, Cpu, Gem, ChartLine, CircuitBoard, Blocks, Radar, Network, Bot]

export function RobotPlanIcon({ number, color }: { number: number; color: string }) {
  const Icon = planIcons[(number - 1) % planIcons.length]
  return <span className={`robot-title-icon ${color}`} aria-hidden="true"><Icon size={17} strokeWidth={1.8} /></span>
}
