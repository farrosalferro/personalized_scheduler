import React, { useState } from "react";
import { useTaskContext } from "../context/TaskContext";

interface Task {
    id: number;
    title: string;
    description: string;
    priority: string;
    deadline: string;
    duration: number;
    is_due_date: boolean;
}

interface EditTaskFormProps {
    task: Task;
    onCancel: () => void;
    onComplete: () => void;
}

const EditTaskForm: React.FC<EditTaskFormProps> = ({ task, onCancel, onComplete }) => {
    const { editTask } = useTaskContext();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Extract date and time from the deadline
    const date = new Date(task.deadline);
    const dateString = date.toISOString().split('T')[0];
    const timeString = date.toTimeString().slice(0, 5);

    // Calculate end time for non-due-date tasks
    const endDate = new Date(date.getTime() + task.duration * 60000);
    const endTimeString = endDate.toTimeString().slice(0, 5);

    const [editedTask, setEditedTask] = useState({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        deadline: dateString,
        time: timeString,
        endTime: endTimeString,
        duration: task.duration,
        is_due_date: task.is_due_date
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // Combine date and time into full ISO format
            const startDateTime = new Date(`${editedTask.deadline}T${editedTask.time}`);

            // Check if date is valid
            if (isNaN(startDateTime.getTime())) {
                throw new Error("Invalid date or time format");
            }

            let taskToSubmit;

            if (editedTask.is_due_date) {
                // For due date tasks, just use the deadline
                taskToSubmit = {
                    title: editedTask.title,
                    description: editedTask.description || "",
                    priority: editedTask.priority,
                    deadline: startDateTime.toISOString(),
                    duration: 15, // Small duration for visualization
                    is_due_date: true
                };
            } else {
                // For time slot tasks, calculate duration from start and end times
                const endDateTime = new Date(`${editedTask.deadline}T${editedTask.endTime}`);

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
                    title: editedTask.title,
                    description: editedTask.description || "",
                    priority: editedTask.priority,
                    deadline: startDateTime.toISOString(),
                    duration: durationMinutes,
                    is_due_date: false
                };
            }

            // Use the context's editTask function
            await editTask(task.id, taskToSubmit);
            onComplete();

        } catch (err: any) {
            console.error("Failed to edit task:", err);
            setError(`Failed to edit task: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ padding: "10px" }}>
            <h3>Edit Task</h3>

            {error && (
                <div style={{ color: "red", marginBottom: "10px", padding: "5px", backgroundColor: "#ffeeee", borderRadius: "5px" }}>
                    {error}
                </div>
            )}

            <div style={{ marginBottom: "10px" }}>
                <label htmlFor="title" style={{ display: "block", marginBottom: "5px" }}>Title:</label>
                <input
                    id="title"
                    type="text"
                    value={editedTask.title}
                    onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                    required
                    style={{ width: "100%", padding: "8px" }}
                />
            </div>

            <div style={{ marginBottom: "10px" }}>
                <label htmlFor="description" style={{ display: "block", marginBottom: "5px" }}>Description:</label>
                <textarea
                    id="description"
                    value={editedTask.description}
                    onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                    style={{ width: "100%", padding: "8px" }}
                />
            </div>

            <div style={{ marginBottom: "10px" }}>
                <label htmlFor="priority" style={{ display: "block", marginBottom: "5px" }}>Priority:</label>
                <select
                    id="priority"
                    value={editedTask.priority}
                    onChange={(e) => setEditedTask({ ...editedTask, priority: e.target.value })}
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
                            checked={!editedTask.is_due_date}
                            onChange={() => setEditedTask({ ...editedTask, is_due_date: false })}
                        />
                        Time Slot
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="taskType"
                            checked={editedTask.is_due_date}
                            onChange={() => setEditedTask({ ...editedTask, is_due_date: true })}
                        />
                        Due Date
                    </label>
                </div>
            </div>

            <div style={{ marginBottom: "10px" }}>
                <label htmlFor="editDate" style={{ display: "block", marginBottom: "5px" }}>
                    {editedTask.is_due_date ? "Due Date:" : "Date:"}
                </label>
                <input
                    id="editDate"
                    type="date"
                    value={editedTask.deadline}
                    onChange={(e) => setEditedTask({ ...editedTask, deadline: e.target.value })}
                    required
                    style={{ width: "100%", padding: "8px" }}
                />
            </div>

            <div style={{ marginBottom: "10px" }}>
                <label htmlFor="editTime" style={{ display: "block", marginBottom: "5px" }}>
                    {editedTask.is_due_date ? "Due Time:" : "Start Time:"}
                </label>
                <input
                    id="editTime"
                    type="time"
                    value={editedTask.time}
                    onChange={(e) => setEditedTask({ ...editedTask, time: e.target.value })}
                    required
                    style={{ width: "100%", padding: "8px" }}
                />
            </div>

            {!editedTask.is_due_date && (
                <div style={{ marginBottom: "10px" }}>
                    <label htmlFor="editEndTime" style={{ display: "block", marginBottom: "5px" }}>End Time:</label>
                    <input
                        id="editEndTime"
                        type="time"
                        value={editedTask.endTime}
                        onChange={(e) => setEditedTask({ ...editedTask, endTime: e.target.value })}
                        required
                        style={{ width: "100%", padding: "8px" }}
                    />
                </div>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        flex: 1,
                        padding: "8px",
                        backgroundColor: loading ? "#cccccc" : "#4CAF50",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: loading ? "not-allowed" : "pointer"
                    }}
                >
                    {loading ? "Saving..." : "Save Changes"}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    style={{
                        flex: 1,
                        padding: "8px",
                        backgroundColor: "#f44336",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer"
                    }}
                >
                    Cancel
                </button>
            </div>
        </form>
    );
};

export default EditTaskForm;
