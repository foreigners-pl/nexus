## File Refactoring Plan

**Current**: pp/actions/boards.ts (1096 lines)

**New Structure**:
1. pp/actions/boards/core.ts (~150 lines)
   - getUserBoards
   - createBoard
   - updateBoard
   - deleteBoard
   - getBoardWithData
   - getCasesBoardData

2. pp/actions/boards/statuses.ts (~150 lines)
   - createBoardStatus
   - updateBoardStatus
   - deleteBoardStatus
   - reorderBoardStatuses

3. pp/actions/boards/sharing.ts (~100 lines)
   - shareBoardWithUser
   - removeBoardAccess
   - getBoardAccessList
   - getBoardUsers

4. pp/actions/cards.ts (~200 lines)
   - getBoardCards
   - createCard
   - updateCard
   - deleteCard
   - moveCard
   - getCardWithAssignees

5. pp/actions/assignees.ts (~100 lines)
   - addCardAssignee
   - removeCardAssignee
   - getCardAssignees
   - getAllUsers

6. pp/actions/boards/helpers.ts (~50 lines)
   - hasEditorAccess

Total: ~750 lines (removing duplicates/comments)
