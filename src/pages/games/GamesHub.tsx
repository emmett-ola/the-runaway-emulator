import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { loadUserData, saveUserData } from '../../storage';
import { i18n } from '../../i18n/i18n';
import './GamesHub.css';

// 卡牌数据结构
type Card = {
  id: string;
  number: string;
  nameKey: string;
  descKey: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  owned: boolean;
  count: number;
};

// 8张占位卡片数据，带有编号
const CARDS: Card[] = [
  {
    id: 'card-1',
    number: '#001',
    nameKey: 'games.card_1_name',
    descKey: 'games.card_1_desc',
    rarity: 'common',
    owned: true,
    count: 3
  },
  {
    id: 'card-2',
    number: '#002',
    nameKey: 'games.card_2_name',
    descKey: 'games.card_2_desc',
    rarity: 'common',
    owned: true,
    count: 5
  },
  {
    id: 'card-3',
    number: '#003',
    nameKey: 'games.card_3_name',
    descKey: 'games.card_3_desc',
    rarity: 'uncommon',
    owned: true,
    count: 2
  },
  {
    id: 'card-4',
    number: '#004',
    nameKey: 'games.card_4_name',
    descKey: 'games.card_4_desc',
    rarity: 'uncommon',
    owned: false,
    count: 0
  },
  {
    id: 'card-5',
    number: '#005',
    nameKey: 'games.card_5_name',
    descKey: 'games.card_5_desc',
    rarity: 'rare',
    owned: true,
    count: 1
  },
  {
    id: 'card-6',
    number: '#006',
    nameKey: 'games.card_6_name',
    descKey: 'games.card_6_desc',
    rarity: 'rare',
    owned: false,
    count: 0
  },
  {
    id: 'card-7',
    number: '#007',
    nameKey: 'games.card_7_name',
    descKey: 'games.card_7_desc',
    rarity: 'legendary',
    owned: false,
    count: 0
  },
  {
    id: 'card-8',
    number: '#008',
    nameKey: 'games.card_8_name',
    descKey: 'games.card_8_desc',
    rarity: 'legendary',
    owned: false,
    count: 0
  }
];

export const GamesHub = () => {
  const navigate = useNavigate();
  const username = sessionStorage.getItem('runawaylog-username') || '';
  const [forkInTheRoadEnabled, setForkInTheRoadEnabled] = useState(false);
  const [cardDropEnabled, setCardDropEnabled] = useState(false);
  const [showCardAlbum, setShowCardAlbum] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const cardsPerPage = 6;
  const [currentPageCards, setCurrentPageCards] = useState<Card[]>([]);
  
  // 卡片数据已按顺序排列，可直接通过索引访问
  
  const handleLogout = () => {
    sessionStorage.removeItem('runawaylog-username');
    navigate('/');
    window.location.reload();
  };
  
  // 从用户数据加载游戏设置和卡片拥有情况
  useEffect(() => {
    const fetchUserData = async () => {
      const userData = await loadUserData(username);
      if (userData?.settings?.games) {
        // 加载游戏功能开关设置
        if (userData.settings.games.forkInTheRoadEnabled !== undefined) {
          setForkInTheRoadEnabled(userData.settings.games.forkInTheRoadEnabled);
        }
        if (userData.settings.games.cardDropEnabled !== undefined) {
          setCardDropEnabled(userData.settings.games.cardDropEnabled);
        }
      }
      
      // 确保用户数据中记录每个卡片的拥有数量，初始值为0
      if (userData) {
        // 初始化卡片拥有数量记录
        const cardCollections = userData.cardCollections || {};
        const updatedCollections = { ...cardCollections };
        
        // 为每个卡片确保有对应的拥有数量记录
        CARDS.forEach(card => {
          if (updatedCollections[card.number] === undefined) {
            updatedCollections[card.number] = 0;
          }
        });
        
        // 如果有更新，保存用户数据
        if (JSON.stringify(updatedCollections) !== JSON.stringify(cardCollections)) {
          await saveUserData({
            ...userData,
            cardCollections: updatedCollections
          });
        }
      }
    };
    
    fetchUserData();
  }, [username]);
  
  // Save game settings to user data
  const handleForkInTheRoadToggle = async () => {
    const userData = await loadUserData(username);
    if (userData) {
      const newEnabled = !forkInTheRoadEnabled;
      const updatedSettings = {
        ...userData.settings,
        games: {
          ...userData.settings?.games,
          forkInTheRoadEnabled: newEnabled
        }
      };
      
      await saveUserData({
        ...userData,
        settings: updatedSettings
      });
      
      setForkInTheRoadEnabled(newEnabled);
    }
  };
  
  // Toggle card drop game enabled state
  const handleCardDropToggle = async () => {
    const userData = await loadUserData(username);
    if (userData) {
      const newEnabled = !cardDropEnabled;
      const updatedSettings = {
        ...userData.settings,
        games: {
          ...userData.settings?.games,
          cardDropEnabled: newEnabled
        }
      };
      
      await saveUserData({
        ...userData,
        settings: updatedSettings
      });
      
      setCardDropEnabled(newEnabled);
    }
  };
  
  // Toggle slot machine enabled state
  const handleSlotMachineToggle = () => {
    // Slot machine is coming soon, so this is just a placeholder
    return;
  };
  
  // Toggle achievements enabled state
  const handleAchievementsToggle = () => {
    // Achievements is coming soon, so this is just a placeholder
    return;
  };
  
  // Toggle daily challenges enabled state
  const handleDailyChallengesToggle = () => {
    // Daily challenges is coming soon, so this is just a placeholder
    return;
  };
  
  // 打开集卡册
  const openCardAlbum = () => {
    setShowCardAlbum(true);
    setCurrentPage(0);
  };
  
  // 关闭集卡册
  const closeCardAlbum = () => {
    setShowCardAlbum(false);
  };
  
  // 下一页
  const nextPage = () => {
    setCurrentPage((prev) => {
      const totalPages = Math.ceil(CARDS.length / cardsPerPage);
      return (prev + 1) % totalPages;
    });
  };
  
  // 上一页
  const prevPage = () => {
    setCurrentPage((prev) => {
      const totalPages = Math.ceil(CARDS.length / cardsPerPage);
      return (prev - 1 + totalPages) % totalPages;
    });
  };
  
  // 获取当前页的卡片，不足的用空白格子填充，并从用户数据中获取实际的拥有数量
  useEffect(() => {
    const fetchCurrentPageCards = async () => {
      const userData = await loadUserData(username);
      const cardCollections = userData?.cardCollections || {};
      
      // 卡片数据 - 这里直接定义，避免依赖外部cards数组
      
      // 获取当前页的原始卡片
      const startIndex = currentPage * cardsPerPage;
      const endIndex = startIndex + cardsPerPage;
      const currentCards = CARDS.slice(startIndex, endIndex);
      
      // 更新卡片的拥有状态和数量
      const updatedCards = currentCards.map(card => {
        const count = cardCollections[card.number] || 0;
        return {
          ...card,
          count,
          owned: count > 0
        };
      });
      
      // 不足cardsPerPage张的部分用空白格子填充
      const filledCards = [...updatedCards];
      while (filledCards.length < cardsPerPage) {
        filledCards.push({
          id: `empty-${filledCards.length + startIndex}`,
          number: '',
          nameKey: '',
          descKey: '',
          rarity: 'common' as const,
          owned: false,
          count: 0
        });
      }
      
      setCurrentPageCards(filledCards);
    };
    
    fetchCurrentPageCards();
  }, [currentPage, username]);
  const rarityLabels = {
    common: i18n.t('games.rarity_common'),
    uncommon: i18n.t('games.rarity_uncommon'),
    rare: i18n.t('games.rarity_rare'),
    legendary: i18n.t('games.rarity_legendary'),
  };
  return (
    <Layout username={username} onLogout={handleLogout}>
      <div className="games-hub">
      <div className="games-container">
        <h1 className="games-title">{i18n.t('games.hub_title')}</h1>
        <p className="games-subtitle">
          {i18n.t('games.hub_subtitle')}
        </p>

        <div className="games-grid">
          <div className="game-card" style={{ position: 'relative', cursor: 'default' }}>
            {/* Enable checkbox in top-right corner */}
            <div style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              zIndex: 10,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: cardDropEnabled ? 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)' : '#e0e0e0',
              transition: 'all 0.3s ease',
              boxShadow: 'var(--shadow-sm)',
              opacity: 1
            }} onClick={() => {
              handleCardDropToggle();
            }}>
              {cardDropEnabled && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <div className="game-icon">🃏</div>
            <h3 className="game-name">{i18n.t('games.card_drop')}</h3>
            <p className="game-description">
              {i18n.t('games.card_drop_description')}
            </p>
            <button style={{
              padding: '0.5rem 1rem',
              background: cardDropEnabled ? 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)' : '#e0e0e0',
              border: 'none',
              borderRadius: '20px',
              cursor: cardDropEnabled ? 'pointer' : 'not-allowed',
              fontWeight: '600',
              color: cardDropEnabled ? 'white' : 'var(--text-tertiary)',
              fontSize: '0.85rem',
              margin: '0.5rem',
              opacity: cardDropEnabled ? 1 : 0.7,
              transition: 'all 0.3s ease'
            }} onClick={() => {
              if (cardDropEnabled) {
                openCardAlbum();
              }
            }}>
              {i18n.t('games.card_album')}
            </button>
          </div>

          <div className="game-card" style={{ position: 'relative' }}>
            {/* Enable checkbox in top-right corner */}
            <div style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              zIndex: 10,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: forkInTheRoadEnabled ? 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)' : '#e0e0e0',
              transition: 'all 0.3s ease',
              boxShadow: 'var(--shadow-sm)'
            }} onClick={() => handleForkInTheRoadToggle()}>
              {forkInTheRoadEnabled && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <div className="game-icon">➡️</div>
            <h3 className="game-name">{i18n.t('games.fork_in_the_road')}</h3>
            <p className="game-description">
              {i18n.t('games.fork_in_the_road_description')}
            </p>
          </div>

          <div className="game-card disabled" style={{ position: 'relative' }}>
            {/* Enable checkbox placeholder - coming soon */}
            <div style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              zIndex: 10,
              cursor: 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: '#e0e0e0',
              transition: 'all 0.3s ease',
              boxShadow: 'var(--shadow-sm)',
              opacity: 0.6
            }} onClick={handleSlotMachineToggle}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9e9e9e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="game-icon">🎰</div>
            <h3 className="game-name">{i18n.t('games.slot_machine')}</h3>
            <p className="game-description">
              {i18n.t('games.slot_machine_description')}
            </p>
            <span className="game-status">{i18n.t('games.coming_soon')}</span>
          </div>

          <div className="game-card disabled" style={{ position: 'relative' }}>
            {/* Enable checkbox placeholder - coming soon */}
            <div style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              zIndex: 10,
              cursor: 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: '#e0e0e0',
              transition: 'all 0.3s ease',
              boxShadow: 'var(--shadow-sm)',
              opacity: 0.6
            }} onClick={handleAchievementsToggle}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9e9e9e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="game-icon">🏆</div>
            <h3 className="game-name">{i18n.t('games.achievements')}</h3>
            <p className="game-description">
              {i18n.t('games.achievements_description')}
            </p>
            <span className="game-status">{i18n.t('games.coming_soon')}</span>
          </div>

          <div className="game-card disabled" style={{ position: 'relative' }}>
            {/* Enable checkbox placeholder - coming soon */}
            <div style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              zIndex: 10,
              cursor: 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: '#e0e0e0',
              transition: 'all 0.3s ease',
              boxShadow: 'var(--shadow-sm)',
              opacity: 0.6
            }} onClick={handleDailyChallengesToggle}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9e9e9e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="game-icon">⚡</div>
            <h3 className="game-name">{i18n.t('games.daily_challenges')}</h3>
            <p className="game-description">
              {i18n.t('games.daily_challenges_description')}
            </p>
            <span className="game-status">{i18n.t('games.coming_soon')}</span>
          </div>
        </div>

        {/* 集卡册模态框 */}
        {showCardAlbum && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(5px)'
          }}>
            <div style={{
              background: 'var(--bg-primary)',
              borderRadius: '20px',
              padding: '2rem',
              maxWidth: '900px',
              width: '95%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
              textAlign: 'center',
              position: 'relative'
            }}>
              {/* 关闭按钮 */}
              <button style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: 'var(--text-secondary)'
              }} onClick={closeCardAlbum}>
                ✕
              </button>
              
              {/* 集卡册标题 */}
              <h2 style={{
                fontSize: '2rem',
                marginBottom: '1.5rem',
                color: 'var(--text-primary)'
              }}>
                {i18n.t('games.card_album')}
              </h2>
              
              {/* 分页信息 */}
              <div style={{
                marginBottom: '1.5rem',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)'
              }}>
                {i18n.t('games.album_page_info', { current: currentPage + 1, total: Math.ceil(CARDS.length / cardsPerPage) })}
              </div>
              
              {/* 卡片网格展示区域 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.5rem',
                margin: '1rem 0',
                justifyContent: 'center'
              }}>
                {currentPageCards.map((card) => {
                  // 检查是否为空白卡片
                  const isEmptyCard = !card.nameKey;
                  
                  if (isEmptyCard) {
                    // 空白卡片只显示空白格子，保持布局一致性
                    return (
                      <div key={card.id} style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '15px',
                        padding: '1.5rem',
                        minHeight: '250px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.5,
                        transition: 'all 0.3s ease'
                      }} />
                    );
                  }
                  
                  // 正常卡片的渲染
                  return (
                    <div key={card.id} style={{
                      background: card.owned ? 'white' : 'rgba(255, 255, 255, 0.7)',
                      border: `2px solid ${card.owned ? '#4caf50' : '#e0e0e0'}`,
                      borderRadius: '15px',
                      padding: '1.5rem',
                      minHeight: '250px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: card.owned ? 1 : 0.7,
                      transition: 'all 0.3s ease',
                      position: 'relative'
                    }}>
                      {/* 卡片编号，显示在左上角 */}
                      <div style={{
                        position: 'absolute',
                        top: '0.8rem',
                        left: '0.8rem',
                        fontSize: '0.7rem',
                        fontWeight: '600',
                        color: 'var(--text-tertiary)',
                        background: 'var(--bg-secondary)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '8px'
                      }}>
                        {card.number}
                      </div>
                      
                      <h3 style={{
                        fontSize: '1.4rem',
                        marginBottom: '0.8rem',
                        color: card.owned ? 'var(--text-primary)' : '#9e9e9e'
                      }}>
                        {i18n.t(card.nameKey)}
                      </h3>
                      <p style={{
                        fontSize: '0.9rem',
                        marginBottom: '0.8rem',
                        color: card.owned ? 'var(--text-secondary)' : '#9e9e9e',
                        maxWidth: '90%',
                        flex: 1
                      }}>
                        {i18n.t(card.descKey)}
                      </p>
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '10px',
                        marginBottom: '0.5rem',
                        color: 'white',
                        background: card.rarity === 'common' ? '#4caf50' :
                                   card.rarity === 'uncommon' ? '#2196f3' :
                                   card.rarity === 'rare' ? '#9c27b0' : '#ff9800'
                      }}>
                        {rarityLabels[card.rarity]}
                      </div>
                      {card.owned && (
                        <div style={{
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          color: '#4caf50',
                          marginTop: '0.5rem'
                        }}>
                          {i18n.t('games.album_owned_count', { count: card.count })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* 分页导航按钮 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '2rem'
              }}>
                <button onClick={prevPage} style={{
                  padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                  border: 'none',
                  borderRadius: '50px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  color: 'white',
                  fontSize: '1rem'
                }}>
                  {i18n.t('games.album_prev')}
                </button>
                
                <button onClick={nextPage} style={{
                  padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
                  border: 'none',
                  borderRadius: '50px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  color: 'white',
                  fontSize: '1rem'
                }}>
                  {i18n.t('games.album_next')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </Layout>
  );
};
