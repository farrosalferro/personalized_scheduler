import React, { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useTaskContext } from "../context/TaskContext";
import TaskEditModal from "./TaskEditModal";
import TaskAddModal from "./TaskAddModal";

// Custom confirm function to avoid ESLint warning
const customConfirm = (message: string): boolean => {
    // eslint-disable-next-line no-restricted-globals
    return window.confirm(message);
};

interface CalendarTask {
    id: number;
    title: string;
    description: string;
    priority: string;
    deadline: string;
    duration: number;
    is_due_date: boolean;
}

interface DateSelectInfo {
    start: Date;
    end: Date;
    allDay: boolean;
    view: any;
}

const Calendar: React.FC = () => {
    const { tasks, refreshTasks, deleteTask, editTask, addTask } = useTaskContext();
    const [events, setEvents] = useState<any[]>([]);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState<CalendarTask | null>(null);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ start: Date, end: Date } | null>(null);

    // Convert tasks to calendar events
    useEffect(() => {
        const formattedTasks = tasks.map((task) => {
            // Calculate end time based on duration or use deadline for due date tasks
            const start = new Date(task.deadline);
            let end;

            if (task.is_due_date) {
                // For due date tasks, we'll just show a point in time
                // But make it visible by setting a small duration (15 min)
                end = new Date(start.getTime() + 15 * 60000);
            } else {
                // For time slot tasks, use the duration
                end = new Date(start.getTime() + task.duration * 60000);
            }

            // Preserve local time instead of UTC shift
            const formattedStart = start.toLocaleString("sv-SE").replace(" ", "T");
            const formattedEnd = end.toLocaleString("sv-SE").replace(" ", "T");

            // Set color based on priority
            let backgroundColor = "#3788d8"; // Default blue
            if (task.priority === "High") backgroundColor = "#d83737"; // Red for high priority
            else if (task.priority === "Low") backgroundColor = "#37d88a"; // Green for low priority

            // Add a special marker for due date tasks
            const title = task.is_due_date ? `📅 DUE: ${task.title}` : task.title;

            return {
                id: task.id,
                title: title,
                start: formattedStart,
                end: formattedEnd,
                backgroundColor,
                extendedProps: {
                    description: task.description,
                    priority: task.priority,
                    is_due_date: task.is_due_date
                }
            };
        });

        setEvents(formattedTasks);
    }, [tasks]);

    const handleEventClick = (info: any) => {
        const event = info.event;
        const isDueDate = event.extendedProps.is_due_date;
        const taskId = Number(event.id);

        // Find the original task data
        const task = tasks.find(t => t.id === taskId);

        if (task) {
            setSelectedTask(task);
            setShowEditModal(true);
        }
    };

    const handleDateSelect = (selectInfo: DateSelectInfo) => {
        const { start, end } = selectInfo;

        // Set the selected time slot
        setSelectedTimeSlot({ start, end });

        // Show the add task modal
        setShowAddModal(true);

        // Important: clear the date selection
        const calendarApi = selectInfo.view.calendar;
        calendarApi.unselect();
    };

    const handleCloseEditModal = () => {
        setShowEditModal(false);
        setSelectedTask(null);
    };

    const handleCloseAddModal = () => {
        setShowAddModal(false);
        setSelectedTimeSlot(null);
    };

    const handleDeleteTask = (taskId: number) => {
        const confirmed = customConfirm("Are you sure you want to delete this task?");

        if (confirmed) {
            deleteTask(taskId);
            handleCloseEditModal();
        }
    };

    const handleSaveTask = async (taskData: any) => {
        if (selectedTask) {
            try {
                await editTask(selectedTask.id, taskData);
                handleCloseEditModal();
            } catch (error) {
                console.error("Failed to update task:", error);
            }
        }
    };

    const handleAddTask = async (taskData: any) => {
        try {
            await addTask(taskData);
            handleCloseAddModal();
        } catch (error) {
            console.error("Failed to add task:", error);
        }
    };

    return (
        <div style={{ height: "650px", padding: "10px" }}>
            <button
                onClick={refreshTasks}
                style={{
                    marginBottom: "10px",
                    padding: "5px 10px",
                    backgroundColor: "#007BFF",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer"
                }}
            >
                🔄 Refresh Calendar
            </button>
            <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                headerToolbar={{
                    left: "prev,next today",
                    center: "title",
                    right: "dayGridMonth,timeGridWeek,timeGridDay",
                }}
                events={events}
                eventClick={handleEventClick}
                slotMinTime="06:00:00"
                slotMaxTime="22:00:00"
                allDaySlot={false}
                height="100%"
                selectable={true}
                select={handleDateSelect}
                selectMirror={true}
                dayMaxEvents={true}
                nowIndicator={true}
            />

            {showEditModal && selectedTask && (
                <TaskEditModal
                    task={selectedTask}
                    onClose={handleCloseEditModal}
                    onSave={handleSaveTask}
                    onDelete={handleDeleteTask}
                />
            )}

            {showAddModal && selectedTimeSlot && (
                <TaskAddModal
                    startDate={selectedTimeSlot.start}
                    endDate={selectedTimeSlot.end}
                    onClose={handleCloseAddModal}
                    onSave={handleAddTask}
                />
            )}
        </div>
    );
};

export default Calendar;
