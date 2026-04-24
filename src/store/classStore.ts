import { create } from 'zustand';

export interface StudentInfo {
  id: string;        // studentNo — uygulama genelinde birincil anahtar
  name: string;
  className: string;
  studentNo: string;
  photoUrl: string | null;
  deskId: string | null; // e.g., 'desk-0', 'desk-1'
}

interface ClassState {
  students: StudentInfo[];
  hasUnsavedChanges: boolean;
  setStudents: (students: StudentInfo[]) => void;
  moveOrSwapStudent: (activeId: string, overDeskId: string) => void;
  setUnsaved: (val: boolean) => void;
}

export const useClassStore = create<ClassState>((set) => ({
  students: [],
  hasUnsavedChanges: false,
  
  setStudents: (students) => set({ students, hasUnsavedChanges: false }),
  
  setUnsaved: (val) => set({ hasUnsavedChanges: val }),

  moveOrSwapStudent: (activeId, overDeskId) => set((state) => {
    const newStudents = [...state.students];
    const activeStudentIndex = newStudents.findIndex(s => s.id === activeId);
    
    if (activeStudentIndex === -1) return state;
    
    const activeStudent = newStudents[activeStudentIndex];
    const targetStudentIndex = newStudents.findIndex(s => s.deskId === overDeskId);

    // Swap işlemi
    if (targetStudentIndex !== -1) {
      const targetStudent = newStudents[targetStudentIndex];
      // Target olanı Active olanın eski masasına al
      targetStudent.deskId = activeStudent.deskId;
    }
    
    // Active olanı doğrudan hedefe koy
    activeStudent.deskId = overDeskId;

    return { students: newStudents, hasUnsavedChanges: true };
  })
}));
