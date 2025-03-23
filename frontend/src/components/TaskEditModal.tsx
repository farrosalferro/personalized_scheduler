import React, { useState } from "react";

interface Task {
    id: number;
    title: string;
    description: string;
    priority: string;
    deadline: string;
    duration: number;
    is_due_date: boolean;
}

interface TaskEditModalProps {
    task: Task;
    onClose: () => void;
    onSave: (taskData: any) => void;
    onDelete: (taskId: number) => void;
}

const TaskEditModal: React.FC<TaskEditModalProps> = ({ task, onClose, onSave, onDelete }) => {
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
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
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

            // Call the onSave function passed from parent component
            onSave(taskToSubmit);

        } catch (err: any) {
            console.error("Failed to update task:", err);
            setError(`Failed to update task: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Edit Task</h2>
                    <button className="modal-close-button" onClick={onClose}>×</button>
                </div>

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="title">Title:</label>
                        <input
                            id="title"
                            type="text"
                            value={editedTask.title}
                            onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                            required
                            className="form-input"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">Description:</label>
                        <textarea
                            id="description"
                            value={editedTask.description}
                            onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                            className="form-textarea"
                            rows={4}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="priority">Priority:</label>
                        <select
                            id="priority"
                            value={editedTask.priority}
                            onChange={(e) => setEditedTask({ ...editedTask, priority: e.target.value })}
                            className="form-select"
                        >
                            <option value="Low">Low</option>
                            <option value="Normal">Normal</option>
                            <option value="High">High</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Task Type:</label>
                        <div className="radio-group">
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    name="taskType"
                                    checked={!editedTask.is_due_date}
                                    onChange={() => setEditedTask({ ...editedTask, is_due_date: false })}
                                />
                                Time Slot
                            </label>
                            <label className="radio-label">
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

                    <div className="form-group">
                        <label htmlFor="date">
                            {editedTask.is_due_date ? "Due Date:" : "Date:"}
                        </label>
                        <input
                            id="date"
                            type="date"
                            value={editedTask.deadline}
                            onChange={(e) => setEditedTask({ ...editedTask, deadline: e.target.value })}
                            required
                            className="form-input"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="time">
                            {editedTask.is_due_date ? "Due Time:" : "Start Time:"}
                        </label>
                        <input
                            id="time"
                            type="time"
                            value={editedTask.time}
                            onChange={(e) => setEditedTask({ ...editedTask, time: e.target.value })}
                            required
                            className="form-input"
                        />
                    </div>

                    {!editedTask.is_due_date && (
                        <div className="form-group">
                            <label htmlFor="endTime">End Time:</label>
                            <input
                                id="endTime"
                                type="time"
                                value={editedTask.endTime}
                                onChange={(e) => setEditedTask({ ...editedTask, endTime: e.target.value })}
                                required
                                className="form-input"
                            />
                        </div>
                    )}

                    <div className="modal-footer">
                        <button
                            type="button"
                            onClick={onClose}
                            className="button button-secondary"
                        >
                            Cancel
                        </button>

                        <div className="button-group">
                            <button
                                type="button"
                                onClick={() => onDelete(task.id)}
                                className="button button-danger"
                            >
                                Delete
                            </button>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`button button-primary ${loading ? 'button-loading' : ''}`}
                            >
                                {loading ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TaskEditModal;
