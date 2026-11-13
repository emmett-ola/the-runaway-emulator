import { useState, useEffect, useRef } from 'react';
import { animate } from 'animejs';
import type { UserData } from '../types';
import { addHit, loadUserData, saveUserData } from '../storage';
import { getRandomQuote } from '../quotes';
import { exportUserData, importUserData, combineImportedHits, SettingsMenu } from '../features/settings';
import { getSavedTimezone } from '../timezone';
import { HitCalendar } from './HitCalendar';
import { HitLogs } from './HitLogs';
import { PrintCalendar } from '../features/print';
import { RunScene } from './RunScene';
import { Statistics } from './Statistics';
import { i18n } from '../i18n/i18n';
import './Dashboard.css';

interface DashboardProps {
  username: string;
  onLogout: () => void;
  showHeader?: boolean;
}

export const Dashboard = ({ username, onLogout, showHeader = true }: DashboardProps) => {
  const [userData, setUserData] = useState<UserData>({ username, hits: [] });
  const [isAnimating, setIsAnimating] = useState(false);
  const [quote, setQuote] = useState<string>(() => getRandomQuote());
  const [importDialog, setImportDialog] = useState<{ show: boolean; data: UserData | null }>({ show: false, data: null });
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [timezone, setTimezone] = useState<string>(() => getSavedTimezone());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [gameSettings, setGameSettings] = useState<{ forkInTheRoadEnabled?: boolean }>({ forkInTheRoadEnabled: false });
  const [correctButtonIndex, setCorrectButtonIndex] = useState(() => Math.floor(Math.random() * 3));
  const [sceneOpen, setSceneOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([null, null, null]);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // R1: scene flags live in component state only — never persisted.
  const sceneShownRef = useRef(false);
  const sceneTriggerRef = useRef<HTMLButtonElement | null>(null);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Load user data on mount
  useEffect(() => {
    const fetchUserData = async () => {
      const data = await loadUserData(username);
      if (data) {
        setUserData(data);
        if (data.settings?.games) {
          setGameSettings(data.settings.games);
        }
      }
    };

    fetchUserData();
  }, [username]);

  // Format current time using user's timezone (24-hour format)
  const formattedTime = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: timezone
  });

  useEffect(() => {
    if (containerRef.current) {
      animate(containerRef.current, {
        opacity: [0, 1],
        duration: 600,
        ease: 'out(3)',
      });
    }
  }, []);

  // Update quote when language changes
  useEffect(() => {
    const unsubscribe = i18n.onLanguageChange(() => {
      setQuote(getRandomQuote());
    });

    return () => unsubscribe();
  }, []);

  // Load game settings from user data
  useEffect(() => {
    const fetchGameSettings = async () => {
      try {
        const userData = await loadUserData(username);
        if (userData?.settings?.games) {
          setGameSettings(userData.settings.games);
        }
      } catch (error) {
        console.error('Failed to load game settings:', error);
      }
    };
    
    fetchGameSettings();
  }, [username, userData]);

  const handleHit = (buttonIndex?: number) => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    
    // Check if Fork in the Road game is enabled
    const isForkGameEnabled = gameSettings.forkInTheRoadEnabled;
    const isCorrectButton = isForkGameEnabled ? buttonIndex === correctButtonIndex : true;
    
    // Easter egg: 0.6% chance for boom animation
    const isBoom = Math.random() < 0.006;
    
    // Determine which button to animate
    const targetButton = isForkGameEnabled ? buttonRefs.current[buttonIndex || 0] : buttonRef.current;
    
    if (targetButton) {
      if (isBoom) {
        // Boom animation - more intense
        animate(targetButton, {
          scale: [1, 1.5, 0.8, 1.2, 1],
          rotate: [0, -15, 15, -10, 10, 0],
          duration: 800,
          ease: 'inOut(3)',
        });

        // Explosion effect
        const explosion = document.createElement('div');
        explosion.className = 'explosion';
        explosion.textContent = '💥';
        targetButton.parentElement?.appendChild(explosion);
        
        animate(explosion, {
          scale: [0, 3, 2.5],
          rotate: [0, 360],
          opacity: [0, 1, 0],
          duration: 1200,
          ease: 'out(3)',
          onComplete: () => explosion.remove(),
        });

        // Multiple explosion particles
        const particles = ['💥', '✨', '⭐', '🔥', '💫'];
        for (let i = 0; i < 8; i++) {
          const particle = document.createElement('div');
          particle.className = 'explosion-particle';
          particle.textContent = particles[Math.floor(Math.random() * particles.length)];
          targetButton.parentElement?.appendChild(particle);
          
          const angle = (Math.PI * 2 * i) / 8;
          const distance = 150 + Math.random() * 100;
          const tx = Math.cos(angle) * distance;
          const ty = Math.sin(angle) * distance;
          
          animate(particle, {
            translateX: [0, tx],
            translateY: [0, ty],
            scale: [0, 1.5, 0],
            rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
            opacity: [1, 1, 0],
            duration: 1000 + Math.random() * 500,
            ease: 'out(2)',
            onComplete: () => particle.remove(),
          });
        }

        // Change quote to something funny
        setQuote(i18n.t('easter_eggs.boom_quote'));
        
        setTimeout(() => setIsAnimating(false), 800);
        // Reset correct button index for next attempt if Fork game is enabled
        if (isForkGameEnabled) {
          setCorrectButtonIndex(Math.floor(Math.random() * 3));
        }
        return; // Don't record this hit
      }

      // Normal animation
      animate(targetButton, {
        scale: [1, 1.3, 0.9, 1.1, 1],
        rotate: [0, -10, 10, -5, 0],
        duration: 600,
        ease: 'inOut(2)',
      });

      // Ripple effect
      const ripple = document.createElement('div');
      ripple.className = 'ripple';
      targetButton.appendChild(ripple);
      
      animate(ripple, {
        scale: [0, 4],
        opacity: [0.6, 0],
        duration: 800,
        ease: 'out(3)',
        onComplete: () => ripple.remove(),
      });

      // Running person animation with random variations
      const runner = document.createElement('div');
      runner.className = 'running-person';
      
      // Random direction: left or right
      const goLeft = Math.random() < 0.5;
      
      // Create inner span for the emoji
      const emoji = document.createElement('span');
      emoji.textContent = '🏃'; // Always use running emoji
      
      runner.appendChild(emoji);
      targetButton.parentElement?.appendChild(runner);
      
      // Calculate button position for animation start
      const buttonRect = targetButton.getBoundingClientRect();
      const parentRect = targetButton.parentElement?.getBoundingClientRect();
      
      if (parentRect) {
        // Set initial position to button center
        const buttonCenterX = buttonRect.left - parentRect.left + buttonRect.width / 2;
        const buttonCenterY = buttonRect.top - parentRect.top + buttonRect.height / 2;
        
        runner.style.position = 'absolute';
        runner.style.left = `${buttonCenterX}px`;
        runner.style.top = `${buttonCenterY}px`;
        runner.style.transform = 'translate(-50%, -50%)';
        runner.style.opacity = '0';
      }
      
      if (isForkGameEnabled && !isCorrectButton) {
        // Failed attempt: up and down shake animation
        animate(runner, {
          translateY: [0, -10, 10, -10, 10, 0],
          scale: [1, 1.2, 1, 1.2, 1],
          opacity: [0, 1, 1, 1, 1, 0],
          duration: 1000,
          ease: 'inOut(2)',
          onComplete: () => runner.remove(),
        });
        
        // Add falling sweat animation as child of runner, so it flips with the character
        for (let i = 0; i < 3; i++) {
          const sweat = document.createElement('div');
          sweat.className = 'sweat-drop';
          sweat.textContent = '💦';
          sweat.style.position = 'absolute';
          sweat.style.fontSize = '1.5rem';
          sweat.style.pointerEvents = 'none';
          sweat.style.zIndex = '101';
          sweat.style.left = '50%';
          sweat.style.top = '-20px';
          sweat.style.transform = 'translateX(15px)'; // Offset to the right of the character
          runner.appendChild(sweat);
          
          // Random delay for each sweat drop
          const delay = i * 150;
          
          animate(sweat, {
            translateY: [0, 50, 100],
            translateX: [15, 25 + Math.random() * 20, 35 + Math.random() * 30],
            opacity: [1, 0.8, 0],
            scale: [1, 1.2, 0.8],
            duration: 800,
            delay: delay,
            ease: 'out(2)',
            onComplete: () => sweat.remove(),
          });
        }
      } else {
        // Successful attempt: normal running animation with full movement
        // Random variations for each run
        const randomDistance = 350 + Math.random() * 150; // 350-500px
        const randomBounce1 = -15 - Math.random() * 15; // -15 to -30px
        const randomBounce2 = -5 - Math.random() * 10; // -5 to -15px
        const randomDuration = 1200 + Math.random() * 600; // 1200-1800ms
        
        // Calculate final position based on direction
        const finalX = goLeft ? -randomDistance : randomDistance;
        const finalScaleX = goLeft ? 1 : -1;
        
        // Use full transform for animation to ensure all properties work together
        animate(runner, {
          transform: [
            `translate(-50%, -50%) scaleX(${finalScaleX}) scale(1)`,
            `translate(calc(-50% + ${finalX * 0.25}px), calc(-50% + ${randomBounce1}px)) scaleX(${finalScaleX}) scale(1.1)`,
            `translate(calc(-50% + ${finalX * 0.5}px), -50%) scaleX(${finalScaleX}) scale(0.9)`,
            `translate(calc(-50% + ${finalX * 0.75}px), calc(-50% + ${randomBounce2}px)) scaleX(${finalScaleX}) scale(1.05)`,
            `translate(calc(-50% + ${finalX}px), -50%) scaleX(${finalScaleX}) scale(1)`
          ],
          opacity: [0, 1, 1, 1, 0],
          duration: randomDuration,
          ease: 'out(2)',
          onComplete: () => runner.remove(),
        });
      }
    }

    // Add hit to storage only if it's the correct button or not in Fork game mode
    if (isCorrectButton) {
      const addHitAsync = async () => {
        const newHit = await addHit(username);
        if (newHit) {
          setUserData(prev => ({
            ...prev,
            hits: [...prev.hits, newHit],
          }));
        }
      };
      
      addHitAsync();

      // Change quote on successful hit
      setQuote(getRandomQuote());
    }

    setTimeout(() => {
      setIsAnimating(false);

      // R1 (spec §2.3): on the success path only, and only once per page
      // session, the post-Run scene mounts at the end of this existing 600 ms
      // window. No new timer, no change to the animation timing.
      if (isCorrectButton && !sceneShownRef.current) {
        sceneShownRef.current = true;
        sceneTriggerRef.current = targetButton ?? null;
        setSceneOpen(true);
      }
    }, 600);
    
    // Reset correct button index for next attempt if Fork game is enabled
    if (isForkGameEnabled) {
      setTimeout(() => {
        setCorrectButtonIndex(Math.floor(Math.random() * 3));
      }, 600);
    }
  };

  const handleExport = () => {
    exportUserData(userData);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const importedData = await importUserData(file);
      setReplaceConfirmed(false);
      setImportDialog({ show: true, data: importedData });
    } catch (error) {
      alert(i18n.t('errors.import_failed', { error: error instanceof Error ? error.message : 'Unknown error' }));
    }

    // Reset file input
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleImportMerge = () => {
    if (!importDialog.data) return;
    
    const hits = combineImportedHits(userData.hits, importDialog.data.hits);
    const newHitCount = hits.length - userData.hits.length;
    const mergedData = {
      ...userData,
      username,
      hits: hits.sort((a, b) => a.timestamp - b.timestamp),
    };
    setUserData(mergedData);
    saveUserData(mergedData);
    
    setImportDialog({ show: false, data: null });
    alert(i18n.t('errors.import_merged', { count: newHitCount }));
    
    // Refresh page to apply all settings
    window.location.reload();
  };

  const handleImportReplace = () => {
    if (!importDialog.data || !replaceConfirmed) return;
    
    const replacedData = {
      ...userData,
      username,
      hits: importDialog.data.hits,
    };
    setUserData(replacedData);
    saveUserData(replacedData);
    
    setImportDialog({ show: false, data: null });
    alert(i18n.t('errors.import_replaced', { count: importDialog.data.hits.length }));
    
    // Refresh page to apply all settings
    window.location.reload();
  };

  const handleImportCancel = () => {
    setImportDialog({ show: false, data: null });
  };

  const handleTimezoneChange = () => {
    setTimezone(getSavedTimezone());
  };

  // R1 close path: Skip, Close and Escape all land here. Nothing is recorded —
  // the hit from the Run itself was already stored by the existing path.
  const handleSceneClose = () => {
    setSceneOpen(false);
    // AC-A6: focus returns to the Run control that opened the scene.
    const trigger = sceneTriggerRef.current;
    if (trigger) {
      trigger.focus();
    }
  };

  return (
    <div className="dashboard-container" ref={containerRef}>
      {showHeader && (
        <header className="dashboard-header">
          <div className="user-info">
            <span className="user-icon">👤</span>
            <span className="username">{username}</span>
          </div>
          <div className="header-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              style={{ display: 'none' }}
            />
            <SettingsMenu
              onExport={handleExport}
              onImport={handleImportClick}
              onPrint={() => setShowPrintDialog(true)}
              onTimezoneChange={handleTimezoneChange}
            />
            <button onClick={onLogout} className="logout-button">
              {i18n.t('dashboard.logout')}
            </button>
          </div>
        </header>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportFile}
        style={{ display: 'none' }}
      />

      <main className="dashboard-main">
        <div className="hit-section">
          <h2 className="section-title">{formattedTime}</h2>
          
          {gameSettings.forkInTheRoadEnabled ? (
            <div className="fork-buttons-container">
              <button
                ref={(el) => { buttonRefs.current[0] = el; }}
                onClick={() => handleHit(0)}
                className="hit-button fork-button left"
                disabled={isAnimating}
              >
                <span className="hit-button-text">{i18n.t('dashboard.run_button')}</span>
                <span className="hit-button-icon">🏃</span>
              </button>
              <button
                ref={(el) => { buttonRefs.current[1] = el; }}
                onClick={() => handleHit(1)}
                className="hit-button fork-button middle"
                disabled={isAnimating}
              >
                <span className="hit-button-text">{i18n.t('dashboard.run_button')}</span>
                <span className="hit-button-icon">🏃</span>
              </button>
              <button
                ref={(el) => { buttonRefs.current[2] = el; }}
                onClick={() => handleHit(2)}
                className="hit-button fork-button right"
                disabled={isAnimating}
              >
                <span className="hit-button-text">{i18n.t('dashboard.run_button')}</span>
                <span className="hit-button-icon">🏃</span>
              </button>
            </div>
          ) : (
            <button
              ref={buttonRef}
              onClick={() => handleHit()}
              className="hit-button"
              disabled={isAnimating}
            >
              <span className="hit-button-text">{i18n.t('dashboard.run_button')}</span>
              <span className="hit-button-icon">🏃</span>
            </button>
          )}
          
          <p className="motivational-quote">"{quote}"</p>
          <p className="hit-count" dangerouslySetInnerHTML={{ __html: i18n.t('dashboard.hit_count', { count: userData.hits.length }) }} />
        </div>

        {userData.hits.length > 0 && (
          <>
            <div className="data-section">
              <Statistics hits={userData.hits} timezone={timezone} />
              <HitCalendar 
                hits={userData.hits} 
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                timezone={timezone}
              />
            </div>
            <HitLogs hits={userData.hits} timezone={timezone} />
          </>
        )}
      </main>

      {sceneOpen && <RunScene onClose={handleSceneClose} />}

      {showPrintDialog && (
        <PrintCalendar
          hits={userData.hits}
          username={username}
          currentMonth={currentMonth}
          onClose={() => setShowPrintDialog(false)}
          timezone={timezone}
        />
      )}

      {importDialog.show && importDialog.data && (
        <div className="import-dialog-overlay">
          <div className="import-dialog">
            <h3 className="import-dialog-title">{i18n.t('import_dialog.title')}</h3>
            <div className="import-dialog-content">
              <p className="import-info">
                <strong>{i18n.t('import_dialog.from')}</strong> {importDialog.data.username}<br />
                <strong>{i18n.t('import_dialog.escape_dreams')}</strong> {importDialog.data.hits.length}
              </p>
              {importDialog.data.username !== username && (
                <p className="import-warning" dangerouslySetInnerHTML={{ __html: i18n.t('import_dialog.warning', { username: importDialog.data.username, currentUsername: username }) }} />
              )}
              <p className="import-description">
                <strong>Merge:</strong> {i18n.t('import_dialog.merge')}<br />
                <strong>Replace:</strong> {i18n.t('import_dialog.replace')}
              </p>
            </div>
            <label className="import-replace-confirmation">
              <input type="checkbox" checked={replaceConfirmed} onChange={event => setReplaceConfirmed(event.target.checked)} />
              {i18n.t('import_dialog.replace')}
            </label>
            <div className="import-dialog-actions">
              <button onClick={handleImportMerge} className="import-dialog-btn merge-btn">
                {i18n.t('import_dialog.merge_button')}
              </button>
              <button onClick={handleImportReplace} disabled={!replaceConfirmed} className="import-dialog-btn replace-btn">
                {i18n.t('import_dialog.replace_button')}
              </button>
              <button onClick={handleImportCancel} className="import-dialog-btn cancel-btn">
                {i18n.t('import_dialog.cancel_button')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
