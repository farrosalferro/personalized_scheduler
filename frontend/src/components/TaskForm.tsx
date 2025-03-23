import React, { useState } from "react";
import { useTaskContext } from "../context/TaskContext";

interface TaskFormProps {
    showNotification: (message: string, type: "success" | "error") => void;
}

const TaskForm: React.FC<TaskFormProps> = ({ showNotification }) => {
    const { addTask } = useTaskContext();
    const [task, setTask] = useState({
        title: "",
        description: "",
        priority: "Normal",
        deadline: "",
        time: "12:00",
        endTime: "13:00",
        duration: 60,
        is_due_date: false
    });
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // Combine date and time into full ISO format
            const startDateTime = new Date(`${task.deadline}T${task.time}`);

            // Check if date is valid
            if (isNaN(startDateTime.getTime())) {
                throw new Error("Invalid date or time format");
            }

            let taskToSubmit;

            if (task.is_due_date) {
                // For due date tasks, just use the deadline
                taskToSubmit = {
                    title: task.title,
                    description: task.description || "",
                    priority: task.priority,
                    deadline: startDateTime.toISOString(),
                    duration: 15, // Small duration for visualization
                    is_due_date: true
                };
            } else {
                // For time slot tasks, calculate duration from start and end times
                const endDateTime = new Date(`${task.deadline}T${task.endTime}`);

                if (isNaN(endDateTime.getTime())) {
                    throw new Error("Invalid end time format");
                }

                if (endDateTime <= startDateTime) {
                    throw new Error("End time must be after start time");
                }

                // Calculate duration in minutes
                const durationMs = endDateTime.getTime() - startDateTime.getTime();
                const durationMinutes = Math.round(durationMs / 60000);

                taskToSubmit = {
                    title: task.title,
                    description: task.description || "",
                    priority: task.priority,
                    deadline: startDateTime.toISOString(),
                    duration: durationMinutes,
                    is_due_date: false
                };
            }

            // Use the context's addTask function
            await addTask(taskToSubmit);

            // Reset form
            setTask({
                title: "",
                description: "",
                priority: "Normal",
                deadline: "",
                time: "12:00",
                endTime: "13:00",
                duration: 60,
                is_due_date: false
            });

            // Show success notification instead of alert
            showNotification(`Task "${taskToSubmit.title}" added successfully!`, "success");

        } catch (err: any) {
            console.error("Failed to add task:", err);
            setError(`Failed to add task: ${err.message}`);
            // Show error notification
            showNotification(`Failed to add task: ${err.message}`, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ maxWidth: "500px", margin: "0 auto" }}>
            <h2>Add New Task</h2>

            {error && (
                <div style={{ color: "red", marginBottom: "10px", padding: "10px", backgroundColor: "#ffeeee", borderRadius: "5px" }}>
                    {error}
                </div>
            )}

            <div style={{ marginBottom: "10px" }}>
                <label htmlFor="title" style={{ display: "block", marginBottom: "5px" }}>Title:</label>
                <input
                    id="title"
                    type="text"
                    placeholder="Task Title"
                    value={task.title}
                    onChange={(e) => setTask({ ...task, title: e.target.value })}
                    required
                    style={{ width: "100%", padding: "8px" }}
                />
            </div>

            <div style={{ marginBottom: "10px" }}>
                <label htmlFor="description" style={{ display: "block", marginBottom: "5px" }}>Description:</label>
                <textarea
                    id="description"
                    placeholder="Description"
                    value={task.description}
                    onChange={(e) => setTask({ ...task, description: e.target.value })}
                    style={{ width: "100%", padding: "8px", minHeight: "80px" }}
                />
            </div>

            <div style={{ marginBottom: "10px" }}>
                <label htmlFor="priority" style={{ display: "block", marginBottom: "5px" }}>Priority:</label>
                <select
                    id="priority"
                    value={task.priority}
                    onChange={(e) => setTask({ ...task, priority: e.target.value })}
                    style={{ width: "100%", padding: "8px" }}
                >
                    <option value="Low">Low</option>
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                </select>
            </div>

            <div style={{ marginBottom: "10px" }}>
                <label htmlFor="taskType" style={{ display: "block", marginBottom: "5px" }}>Task Type:</label>
                <div style={{ display: "flex", gap: "10px" }}>
                    <label>
                        <input
                            type="radio"
                            name="taskType"
                            checked={!task.is_due_date}
                            onChange={() => setTask({ ...task, is_due_date: false })}
                        />
                        Time Slot (Schedule a specific time)
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="taskType"
                            checked={task.is_due_date}
                            onChange={() => setTask({ ...task, is_due_date: true })}
                        />
                        Due Date (Deadline)
                    </label>
                </div>
            </div>

            <div style={{ marginBottom: "10px" }}>
                <label htmlFor="date" style={{ display: "block", marginBottom: "5px" }}>
                    {task.is_due_date ? "Due Date:" : "Date:"}
                </label>
                <input
                    id="date"
                    type="date"
                    value={task.deadline}
                    onChange={(e) => setTask({ ...task, deadline: e.target.value })}
                    required
                    style={{ width: "100%", padding: "8px" }}
                />
            </div>

            <div style={{ marginBottom: "10px" }}>
                <label htmlFor="time" style={{ display: "block", marginBottom: "5px" }}>
                    {task.is_due_date ? "Due Time:" : "Start Time:"}
                </label>
                <input
                    id="time"
                    type="time"
                    value={task.time}
                    onChange={(e) => setTask({ ...task, time: e.target.value })}
                    required
                    style={{ width: "100%", padding: "8px" }}
                />
            </div>

            {!task.is_due_date && (
                <div style={{ marginBottom: "10px" }}>
                    <label htmlFor="endTime" style={{ display: "block", marginBottom: "5px" }}>End Time:</label>
                    <input
                        id="endTime"
                        type="time"
                        value={task.endTime}
                        onChange={(e) => setTask({ ...task, endTime: e.target.value })}
                        required
                        style={{ width: "100%", padding: "8px" }}
                    />
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                style={{
                    width: "100%",
                    padding: "10px",
                    backgroundColor: loading ? "#cccccc" : "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: loading ? "not-allowed" : "pointer"
                }}
            >
                {loading ? "Adding Task..." : "Add Task"}
            </button>
        </form>
    );
};

export default TaskForm;
