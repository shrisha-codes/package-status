import React, { useEffect, useState } from "react";
import axios from "axios";

const PackageDashboard = ({ packageId }) => {
  const [pkg, setPkg] = useState(null);
  const [buildType, setBuildType] = useState("BI");
  const [newComment, setNewComment] = useState("");
  const [editingComment, setEditingComment] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch package details on load
  useEffect(() => {
    fetchPackage();
  }, [packageId]);

  const fetchPackage = async () => {
    try {
      const res = await axios.get(`/api/packages/${packageId}`);
      setPkg(res.data);
    } catch (err) {
      console.error("Error fetching package:", err);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setLoading(true);
    try {
      await axios.post(`/api/packages/${packageId}/comments`, {
        buildType,
        text: newComment, // FIX: match backend schema
      });
      setNewComment("");
      fetchPackage();
    } catch (err) {
      console.error("Error adding comment:", err);
    }
    setLoading(false);
  };

  const handleEditComment = async () => {
    if (!editingComment.text.trim()) return; // FIX: match backend schema
    setLoading(true);
    try {
      await axios.put(`/api/packages/${packageId}/comments/edit`, {
        buildType,
        timestamp: editingComment.timestamp,
        text: editingComment.text, // FIX: match backend schema
      });
      setEditingComment(null);
      fetchPackage();
    } catch (err) {
      console.error("Error editing comment:", err);
    }
    setLoading(false);
  };

  const handleDeleteComment = async (timestamp) => {
    if (!window.confirm("Delete this comment?")) return;
    setLoading(true);
    try {
      await axios.delete(`/api/packages/${packageId}/comments/delete`, {
        data: { buildType, timestamp },
      });
      fetchPackage();
    } catch (err) {
      console.error("Error deleting comment:", err);
    }
    setLoading(false);
  };

  if (!pkg) return <div>Loading package...</div>;

  const comments = pkg.comments?.[buildType] || [];

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">
        Package: {pkg.packageName} ({buildType} comments)
      </h1>

      {/* Build type selector */}
      <select
        value={buildType}
        onChange={(e) => setBuildType(e.target.value)}
        className="border p-1 mb-4"
      >
        {Object.keys(pkg.comments || {}).map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      {/* Comment form */}
      <div className="mb-4">
        {editingComment ? (
          <>
            <textarea
              value={editingComment.text}
              onChange={(e) =>
                setEditingComment({
                  ...editingComment,
                  text: e.target.value, // FIX: match backend schema
                })
              }
              className="border w-full p-2 mb-2"
            />
            <button
              onClick={handleEditComment}
              className="bg-blue-500 text-white px-4 py-1 mr-2"
              disabled={loading}
            >
              Save
            </button>
            <button
              onClick={() => setEditingComment(null)}
              className="bg-gray-500 text-white px-4 py-1"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="border w-full p-2 mb-2"
            />
            <button
              onClick={handleAddComment}
              className="bg-green-500 text-white px-4 py-1"
              disabled={loading}
            >
              Add Comment
            </button>
          </>
        )}
      </div>

      {/* Comments table */}
      <table className="border-collapse border w-full">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Timestamp</th>
            <th className="border p-2">Comment</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {comments.length === 0 ? (
            <tr>
              <td colSpan="3" className="border p-2 text-center">
                No comments yet.
              </td>
            </tr>
          ) : (
            comments.map((c) => (
              <tr key={c.timestamp}>
                <td className="border p-2">
                  {new Date(c.timestamp).toLocaleString()}
                </td>
                <td className="border p-2">{c.text}</td>
                <td className="border p-2">
                  <button
                    onClick={() => setEditingComment(c)}
                    className="bg-yellow-500 text-white px-2 py-1 mr-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteComment(c.timestamp)}
                    className="bg-red-500 text-white px-2 py-1"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default PackageDashboard;