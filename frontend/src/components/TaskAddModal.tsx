import React, { useState } from "react";

interface TaskAddModalProps {
    startDate: Date;
    endDate: Date;
    onClose: () => void;
    onSave: (taskData: any) => void;
}

const TaskAddModal: React.FC<TaskAddModalProps> = ({ startDate, endDate, onClose, onSave }) => {
    // Format date and times from the selected calendar slot
    const dateString = startDate.toISOString().split('T')[0];
    const startTimeString = startDate.toTimeString().slice(0, 5);
    const endTimeString = endDate.toTimeString().slice(0, 5);

    // Calculate default duration in minutes
    const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

    const [newTask, setNewTask] = useState({
        title: "",
        description: "",
        priority: "Normal",
        deadline: dateString,
        time: startTimeString,
        endTime: endTimeString,
        duration: durationMinutes,
        is_due_date: false
    });

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // Validate the title field
            if (!newTask.title.trim()) {
                throw new Error("Task title is required");
            }

            // Combine date and time into full ISO format
            const startDateTime = new Date(`${newTask.deadline}T${newTask.time}`);

            // Check if date is valid
            if (isNaN(startDateTime.getTime())) {
                throw new Error("Invalid date or time format");
            }

            let taskToSubmit;

            if (newTask.is_due_date) {
                // For due date tasks, just use the deadline
                taskToSubmit = {
                    title: newTask.title,
                    description: newTask.description || "",
                    priority: newTask.priority,
                    deadline: startDateTime.toISOString(),
                    duration: 15, // Small duration for visualization
                    is_due_date: true
                };
            } else {
                // For time slot tasks, calculate duration from start and end times
                const endDateTime = new Date(`${newTask.deadline}T${newTask.endTime}`);

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
                    title: newTask.title,
                    description: newTask.description || "",
                    priority: newTask.priority,
                    deadline: startDateTime.toISOString(),
                    duration: durationMinutes,
                    is_due_date: false
                };
            }

            // Call the onSave function passed from parent component
            onSave(taskToSubmit);

        } catch (err: any) {
            console.error("Failed to add task:", err);
            setError(`Failed to add task: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Add New Task</h2>
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
                            value={newTask.title}
                            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                            required
                            className="form-input"
                            placeholder="Enter task title"
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">Description:</label>
                        <textarea
                            id="description"
                            value={newTask.description}
                            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                            className="form-textarea"
                            rows={4}
                            placeholder="Enter task description (optional)"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="priority">Priority:</label>
                        <select
                            id="priority"
                            value={newTask.priority}
                            onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
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
                                    checked={!newTask.is_due_date}
                                    onChange={() => setNewTask({ ...newTask, is_due_date: false })}
                                />
                                Time Slot
                            </label>
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    name="taskType"
                                    checked={newTask.is_due_date}
                                    onChange={() => setNewTask({ ...newTask, is_due_date: true })}
                                />
                                Due Date
                            </label>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="date">
                            {newTask.is_due_date ? "Due Date:" : "Date:"}
                        </label>
                        <input
                            id="date"
                            type="date"
                            value={newTask.deadline}
                            onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                            required
                            className="form-input"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="time">
                            {newTask.is_due_date ? "Due Time:" : "Start Time:"}
                        </label>
                        <input
                            id="time"
                            type="time"
                            value={newTask.time}
                            onChange={(e) => setNewTask({ ...newTask, time: e.target.value })}
                            required
                            className="form-input"
                        />
                    </div>

                    {!newTask.is_due_date && (
                        <div className="form-group">
                            <label htmlFor="endTime">End Time:</label>
                            <input
                                id="endTime"
                                type="time"
                                value={newTask.endTime}
                                onChange={(e) => setNewTask({ ...newTask, endTime: e.target.value })}
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

                        <button
                            type="submit"
                            disabled={loading}
                            className={`button button-primary ${loading ? 'button-loading' : ''}`}
                        >
                            {loading ? "Adding..." : "Add Task"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TaskAddModal;
