import React, { useState, useEffect, useMemo } from 'react';
import './PackageDashboard.css';

const PackageDashboard = () => {
  const [packages, setPackages] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [imageSize, setImageSize] = useState('');
  const [buildType, setBuildType] = useState('BI Build');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const commentsPerPage = 3;
  const [brokenStates, setBrokenStates] = useState({});

  const computeLatestComment = (pkg) => {
    const comments = Object.values(pkg.comments || {})
      .flat()
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (!comments.length) return 'N/A';
    const latest = comments[0];
    const buildTypeKey = Object.entries(pkg.comments || {}).find(([key, arr]) =>
      arr.some(c => c.timestamp === latest.timestamp)
    )?.[0];
    const latestText = latest?.text || latest?.comment || 'N/A';
    return buildTypeKey ? `${buildTypeKey}: ${latestText}` : latestText;
  };

  useEffect(() => {
    fetch('http://localhost:5000/api/packages')
      .then(res => res.json())
      .then(data => {
        const withLatest = data.map(pkg => ({
          ...pkg,
          biBroken: pkg.biBroken ?? false,
          latest_comment: computeLatestComment(pkg)
        }));
        setPackages(withLatest);
      })
      .catch(err => console.error('Error fetching packages:', err));
  }, []);

  const refreshPackage = async (id) => {
    const response = await fetch(`http://localhost:5000/api/packages/${id}`);
    const updated = await response.json();
    setSelectedPackage(updated);
    setPackages(prev =>
      prev.map(pkg =>
        pkg._id === id
          ? { ...updated, biBroken: updated.biBroken ?? false, latest_comment: computeLatestComment(updated) }
          : pkg
      )
    );
    return updated;
  };

  const loadPackageDetails = (pkg) => {
    setSelectedPackage(pkg);
    setBrokenStates({
      biBroken: pkg.biBroken ?? false,
      dockerBroken: pkg.dockerBroken ?? false,
      imageBroken: pkg.imageBroken ?? false,
      binaryBroken: pkg.binaryBroken ?? false,
      ciBroken: pkg.ciBroken ?? false,
    });
    setImageSize(pkg.imageSize || '');
    setCurrentPage(1);
    setEditingIndex(null);
    setEditingText('');
  };

  const handlePackageDoubleClick = (pkg) => {
    loadPackageDetails(pkg);
    setShowModal(true);
  };

  const commentHistory = useMemo(() => {
    if (!selectedPackage) return [];
    return Object.entries(selectedPackage.comments || {}).flatMap(([type, list]) =>
      (list || []).map(c => ({
        ...c,
        type,
        timestamp: c.timestamp || c.date
      }))
    ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [selectedPackage]);

  const paginatedComments = commentHistory.slice(
    (currentPage - 1) * commentsPerPage,
    currentPage * commentsPerPage
  );
  const totalPages = Math.ceil(commentHistory.length / commentsPerPage);

  const syncAfterChange = (updated) => {
    loadPackageDetails(updated);
    setPackages(prev =>
      prev.map(pkg =>
        pkg._id === updated._id
          ? { ...updated, biBroken: updated.biBroken ?? false, latest_comment: computeLatestComment(updated) }
          : pkg
      )
    );
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedPackage) return;
    const id = selectedPackage._id;
    const normalizedType = buildType.replace(' Build', '');
    try {
      await fetch(`http://localhost:5000/api/packages/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildType: normalizedType, text: newComment })
      });
      setNewComment('');
      const updated = await refreshPackage(id);
      syncAfterChange(updated);
    } catch (err) {
      console.error('Add comment failed', err);
    }
  };

  const handleEdit = (paginatedIdx) => {
    const globalIdx = (currentPage - 1) * commentsPerPage + paginatedIdx;
    setEditingIndex(globalIdx);
    setEditingText(commentHistory[globalIdx].text);
  };

  const handleSave = async (paginatedIdx) => {
    const globalIdx = (currentPage - 1) * commentsPerPage + paginatedIdx;
    const comment = commentHistory[globalIdx];
    if (!comment) return;
    const payload = { type: comment.type, text: editingText, timestamp: comment.timestamp };
    try {
      await fetch(`http://localhost:5000/api/packages/${selectedPackage._id}/comments/edit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setEditingIndex(null);
      setEditingText('');
      const updated = await refreshPackage(selectedPackage._id);
      syncAfterChange(updated);
    } catch (err) {
      console.error('Edit comment failed', err);
    }
  };

  const handleDelete = async (paginatedIdx) => {
    const globalIdx = (currentPage - 1) * commentsPerPage + paginatedIdx;
    const comment = commentHistory[globalIdx];
    if (!comment) return;
    const payload = { type: comment.type, timestamp: comment.timestamp };
    try {
      const res = await fetch(`http://localhost:5000/api/packages/${selectedPackage._id}/comments/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const updated = await res.json();
      syncAfterChange(updated);
    } catch (err) {
      console.error('Delete comment failed', err);
    }
  };

  const handleImageSizeChange = async (e) => {
    const newSize = e.target.value;
    setImageSize(newSize);
    if (selectedPackage) {
      try {
        await fetch(`http://localhost:5000/api/packages/${selectedPackage._id}/image-size`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageSize: newSize })
        });
        setPackages(prev =>
          prev.map(pkg =>
            pkg._id === selectedPackage._id ? { ...pkg, imageSize: newSize } : pkg
          )
        );
      } catch (err) {
        console.error('Update image size failed', err);
      }
    }
  };

  const handleBrokenStateChange = async (key) => {
    const updatedState = !brokenStates[key];
    setBrokenStates(prev => ({ ...prev, [key]: updatedState }));
    if (selectedPackage) {
      try {
        const keyMap = {
          biBroken: 'broken',
          dockerBroken: 'dockerBroken',
          imageBroken: 'imageBroken',
          binaryBroken: 'binaryBroken',
          ciBroken: 'ciBroken'
        };
        const apiKey = keyMap[key];
        if (!apiKey) return;
        await fetch(`http://localhost:5000/api/packages/${selectedPackage._id}/broken-state`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [apiKey]: updatedState }),
        });
        setPackages(prev =>
          prev.map(pkg => pkg._id === selectedPackage._id ? { ...pkg, [key]: updatedState } : pkg)
        );
      } catch (err) {
        console.error('Update broken state failed', err);
      }
    }
  };

  return (
    <div className="dashboard">
      <header className="header">
        <div className="logo">PackageMonitor</div>
        <nav className="nav">
          <span className="nav-item active">Dashboard</span>
          <span className="nav-item">Packages</span>
          <span className="nav-item">Distributions</span>
          <span className="nav-item">Reports</span>
        </nav>
        <div className="user-section">
          <span>John Doe ▼</span>
        </div>
      </header>

      <div className="content">
        <div className="page-header">
          <h1>Package Build Status</h1>
          <div className="controls">
            <input type="text" placeholder="Search packages..." className="search-input" />
            <button className="btn-filters">Filters</button>
            <button className="btn-export">Export</button>
          </div>
        </div>

        <table className="package-table">
          <thead>
            <tr>
              <th>SR. NO.</th>
              <th>PACKAGE NAME</th>
              <th>BI BUILD</th>
              <th>CI BUILD</th>
              <th>IMAGE BUILD</th>
              <th>DOCKER BUILD</th>
              <th>BINARY BUILD</th>
              <th>IMAGE</th>
              <th>OWNER</th>
              <th>STATUS</th>
              <th>LATEST COMMENT</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((pkg, index) => (
              <tr key={pkg._id}>
                <td>{index + 1}</td>
                <td className="package-name" onDoubleClick={() => handlePackageDoubleClick(pkg)}>
                  {pkg.packageName}
                </td>
                <td>{pkg.biBroken ? 'Fail' : 'Pass'}</td>
                <td>{pkg.ciBroken ? 'Fail' : 'Pass'}</td>
                <td>{pkg.imageBroken ? 'Fail' : 'Pass'}</td>
                <td>{pkg.dockerBroken ? 'Fail' : 'Pass'}</td>
                <td>{pkg.binaryBroken ? 'Fail' : 'Pass'}</td>
                <td>{pkg.imageSize || 'Empty'}</td>
                <td>{pkg.owner}</td>
                <td>{pkg.status || 'Empty'}</td>
                <td>{pkg.latest_comment || 'N/A'}</td>
                <td><button className="action-btn">⋮</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && selectedPackage && (
        <div className="modal-overlay">
          <div className="modal" style={{ transform: 'scale(1.15)', maxWidth: '800px' }}>
            <div className="modal-header">
              <h2>{selectedPackage.packageName} - Details</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="modal-content">
              <div className="add-comment-section">
                <h3>Add New Comment</h3>
                <div className="form-group">
                  <label>Build Type</label>
                  <select value={buildType} onChange={(e) => setBuildType(e.target.value)} className="select-input">
                    <option>BI Build</option>
                    <option>CI Build</option>
                    <option>Image Build</option>
                    <option>Binary Build</option>
                    <option>Docker Build</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Comment</label>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Enter your comment..."
                    className="comment-textarea"
                  />
                </div>
                <button className="add-comment-btn" onClick={handleAddComment}>Add Comment</button>
              </div>

              <div className="broken-states">
                <h3>Broken States</h3>
                <div className="checkboxes-horizontal">
                  {Object.entries(brokenStates).map(([key, val]) => (
                    <label key={key} style={{ marginRight: 12 }}>
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={() => handleBrokenStateChange(key)}
                      />{' '}
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group-horizontal">
                <label htmlFor="imageSize">Image Size</label>
                <input
                  id="imageSize"
                  type="text"
                  value={imageSize}
                  onChange={handleImageSizeChange}
                  className="imageSize-input"
                />
              </div>

              <div className="comment-history">
                <h3>Comment History</h3>
                <table className="comment-history-table">
                  <thead>
                    <tr>
                      <th>TYPE</th>
                      <th>DATE</th>
                      <th>COMMENT</th>
                      <th>AUTHOR</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedComments.map((comment, paginatedIdx) => (
                      <tr key={comment.timestamp + String(paginatedIdx)}>
                        <td>{comment.type}</td>
                        <td>{new Date(comment.timestamp).toLocaleString()}</td>
                        <td>
                          {editingIndex === ((currentPage - 1) * commentsPerPage + paginatedIdx) ? (
                            <input
                              type="text"
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                            />
                          ) : (
                            comment.text
                          )}
                        </td>
                        <td>{comment.user || 'System'}</td>
                        <td>
                          {editingIndex === ((currentPage - 1) * commentsPerPage + paginatedIdx) ? (
                            <button onClick={() => handleSave(paginatedIdx)}>Save</button>
                          ) : (
                            <button onClick={() => handleEdit(paginatedIdx)}>Edit</button>
                          )}
                          <button onClick={() => handleDelete(paginatedIdx)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div className="pagination">
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        className={i + 1 === currentPage ? 'active' : ''}
                        onClick={() => setCurrentPage(i + 1)}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackageDashboard;