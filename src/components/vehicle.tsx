import { Bike, Bus, Car, Truck, type LucideIcon } from 'lucide-react'
import type { Category } from '../store/types'

export const VEHICLE_ICON: Record<Category, LucideIcon> = {
  Motorcycle: Bike,
  Car: Car,
  Van: Bus,
  Other: Truck,
}
