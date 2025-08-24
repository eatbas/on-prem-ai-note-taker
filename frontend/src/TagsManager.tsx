import { useState, useEffect } from 'react'
import { getTags, updateMeetingTags, type Tag } from './api'

interface TagsManagerProps {
	meetingId?: string
	currentTags?: string[]
	onTagsUpdate?: (tags: string[]) => void
	online: boolean
	vpsUp: boolean | null
	readonly?: boolean
}

export default function TagsManager({ 
	meetingId, 
	currentTags = [], 
	onTagsUpdate, 
	online, 
	vpsUp,
	readonly = false 
}: TagsManagerProps) {
	const [availableTags, setAvailableTags] = useState<Tag[]>([])
	const [selectedTags, setSelectedTags] = useState<string[]>(currentTags)
	const [newTag, setNewTag] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)

	// Load available tags
	useEffect(() => {
		if (!online || !vpsUp) return

		async function loadTags() {
			try {
				setLoading(true)
				const tags = await getTags()
				setAvailableTags(tags)
			} catch (err) {
				console.error('Failed to load tags:', err)
				setError('Failed to load tags')
			} finally {
				setLoading(false)
			}
		}

		loadTags()
	}, [online, vpsUp])

	// Update selected tags when currentTags prop changes
	useEffect(() => {
		setSelectedTags(currentTags)
	}, [currentTags])

	const addTag = (tagName: string) => {
		if (!tagName.trim() || selectedTags.includes(tagName.trim())) return
		
		const newTags = [...selectedTags, tagName.trim()]
		setSelectedTags(newTags)
		
		if (!readonly && onTagsUpdate) {
			onTagsUpdate(newTags)
		}
	}

	const removeTag = (tagName: string) => {
		const newTags = selectedTags.filter(tag => tag !== tagName)
		setSelectedTags(newTags)
		
		if (!readonly && onTagsUpdate) {
			onTagsUpdate(newTags)
		}
	}

	const handleAddNewTag = () => {
		if (newTag.trim()) {
			addTag(newTag.trim())
			setNewTag('')
		}
	}

	const handleSaveTags = async () => {
		if (!meetingId || readonly) return

		try {
			setSaving(true)
			await updateMeetingTags(meetingId, selectedTags)
			if (onTagsUpdate) {
				onTagsUpdate(selectedTags)
			}
		} catch (err) {
			console.error('Failed to save tags:', err)
			setError('Failed to save tags')
		} finally {
			setSaving(false)
		}
	}

	const canEdit = online && vpsUp && !readonly

	return (
		<div className="tags-manager">
			<div className="tags-header">
				<h4>🏷️ Tags</h4>
				{error && (
					<div className="error-message" style={{ fontSize: '12px', color: '#ff6b6b' }}>
						{error}
					</div>
				)}
			</div>

			{/* Selected Tags */}
			<div className="selected-tags" style={{ marginBottom: '12px' }}>
				{selectedTags.length > 0 ? (
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
						{selectedTags.map(tag => (
							<span
								key={tag}
								className="tag-chip"
								style={{
									backgroundColor: '#e3f2fd',
									color: '#1976d2',
									padding: '4px 8px',
									borderRadius: '12px',
									fontSize: '12px',
									display: 'flex',
									alignItems: 'center',
									gap: '4px'
								}}
							>
								{tag}
								{canEdit && (
									<button
										onClick={() => removeTag(tag)}
										style={{
											background: 'none',
											border: 'none',
											color: '#1976d2',
											cursor: 'pointer',
											padding: '0',
											marginLeft: '4px'
										}}
									>
										×
									</button>
								)}
							</span>
						))}
					</div>
				) : (
					<div style={{ color: '#666', fontSize: '12px', fontStyle: 'italic' }}>
						No tags selected
					</div>
				)}
			</div>

			{canEdit && (
				<>
					{/* Add New Tag */}
					<div className="add-tag" style={{ marginBottom: '12px' }}>
						<div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
							<input
								type="text"
								value={newTag}
								onChange={(e) => setNewTag(e.target.value)}
								placeholder="Add new tag..."
								onKeyPress={(e) => e.key === 'Enter' && handleAddNewTag()}
								style={{
									flex: 1,
									padding: '6px',
									border: '1px solid #ddd',
									borderRadius: '4px',
									fontSize: '12px'
								}}
							/>
							<button
								onClick={handleAddNewTag}
								disabled={!newTag.trim()}
								style={{
									padding: '6px 12px',
									backgroundColor: '#1976d2',
									color: 'white',
									border: 'none',
									borderRadius: '4px',
									fontSize: '12px',
									cursor: newTag.trim() ? 'pointer' : 'not-allowed',
									opacity: newTag.trim() ? 1 : 0.5
								}}
							>
								+
							</button>
						</div>
					</div>

					{/* Available Tags */}
					{loading ? (
						<div style={{ fontSize: '12px', color: '#666' }}>Loading tags...</div>
					) : availableTags.length > 0 && (
						<div className="available-tags">
							<div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>
								Popular tags:
							</div>
							<div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
								{availableTags
									.filter(tag => !selectedTags.includes(tag.name))
									.slice(0, 10)
									.map(tag => (
									<button
										key={tag.name}
										onClick={() => addTag(tag.name)}
										className="available-tag"
										style={{
											backgroundColor: '#f5f5f5',
											color: '#666',
											border: '1px solid #ddd',
											padding: '3px 6px',
											borderRadius: '8px',
											fontSize: '11px',
											cursor: 'pointer',
											display: 'flex',
											alignItems: 'center',
											gap: '3px'
										}}
									>
										{tag.name} <span style={{ color: '#999' }}>({tag.count})</span>
									</button>
								))}
							</div>
						</div>
					)}

					{/* Save Button for Meeting Tags */}
					{meetingId && (
						<div style={{ marginTop: '12px' }}>
							<button
								onClick={handleSaveTags}
								disabled={saving}
								style={{
									padding: '8px 16px',
									backgroundColor: '#4caf50',
									color: 'white',
									border: 'none',
									borderRadius: '4px',
									fontSize: '12px',
									cursor: saving ? 'not-allowed' : 'pointer',
									opacity: saving ? 0.7 : 1
								}}
							>
								{saving ? '💾 Saving...' : '💾 Save Tags'}
							</button>
						</div>
					)}
				</>
			)}
		</div>
	)
}
