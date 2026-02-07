const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export interface FrappeEmployee {
  name: string // Frappe document ID
  employee_id: string // Badge number
  employee_name: string
  department?: string
  status: string
}

export interface EmployeeStatus {
  frappeId: string
  employeeId: string
  employeeName: string
  department?: string
  status: string
  isRegistered: boolean
  lastScan?: string
  totalScans: number
}

export async function fetchFrappeEmployees(): Promise<FrappeEmployee[]> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/frappe-employees`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    
    // If API returns error, use mock data
    if (result.error || result.useMock) {
      console.warn('Using mock data:', result.error)
      return getMockEmployees()
    }

    return result.data
  } catch (error) {
    console.error('Error fetching Frappe HR employees:', error)
    console.warn('Falling back to mock data')
    return getMockEmployees()
  }
}

function getMockEmployees(): FrappeEmployee[] {
  return [
    {
      name: "EMP001",
      employee_id: "1",
      employee_name: "John Smith",
      department: "Engineering",
      status: "Active"
    },
    {
      name: "EMP002",
      employee_id: "2",
      employee_name: "Jane Doe",
      department: "HR",
      status: "Active"
    },
    {
      name: "EMP003",
      employee_id: "15",
      employee_name: "Bob Johnson",
      department: "Sales",
      status: "Active"
    },
    {
      name: "EMP004",
      employee_id: "20",
      employee_name: "Alice Williams",
      department: "Marketing",
      status: "Active"
    },
    {
      name: "EMP005",
      employee_id: "25",
      employee_name: "Charlie Brown",
      department: "Engineering",
      status: "Inactive"
    }
  ]
}
