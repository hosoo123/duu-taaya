export default function Home() {
  return (
    <div className="console-app">
      <header className="topbar">
        <div className="topbar-left">
          <button className="menu-button" aria-label="Open navigation">
            ☰
          </button>

          <div className="gsc-brand" aria-label="Google Search Console">
            <span className="gsc-logo" aria-hidden="true">
              <span className="gsc-part blue" />
              <span className="gsc-part red" />
              <span className="gsc-part yellow" />
              <span className="gsc-part green" />
            </span>
            <span className="gsc-title">Google Search Console</span>
          </div>
        </div>

        <div className="search-box" role="search">
          <span className="search-icon" aria-hidden="true">
            ⌕
          </span>
          <span className="search-placeholder">
            Inspect any URL in "duutaay.xyz"
          </span>
        </div>

        <div className="topbar-actions" aria-label="Quick actions">
          <button aria-label="Help">?</button>
          <button aria-label="Notifications">◔</button>
          <button aria-label="Settings">◌</button>
          <button className="profile-pill" aria-label="Profile">
            ZERO
          </button>
        </div>
      </header>

      <div className="workspace-shell">
        <aside className="sidebar">
          <div className="site-selector">
            <span className="site-dot" aria-hidden="true" />
            <span className="site-name">duutaay.xyz</span>
            <span className="caret" aria-hidden="true">
              ▾
            </span>
          </div>

          <nav className="side-nav" aria-label="Sidebar navigation">
            <div className="nav-group">
              <button className="nav-item">
                <span className="nav-icon">⌂</span>
                <span>Overview</span>
              </button>
              <button className="nav-item">
                <span className="nav-icon">◔</span>
                <span>Insights</span>
              </button>
              <button className="nav-item">
                <span className="nav-icon">↗</span>
                <span>Performance</span>
              </button>
              <button className="nav-item active">
                <span className="nav-icon">⌕</span>
                <span>URL inspection</span>
              </button>
            </div>

            <div className="nav-divider" />

            <div className="nav-group">
              <div className="nav-label">Indexing</div>
              <button className="nav-item">
                <span className="nav-icon">▣</span>
                <span>Pages</span>
              </button>
              <button className="nav-item selected">
                <span className="nav-icon">◫</span>
                <span>Sitemaps</span>
              </button>
              <button className="nav-item">
                <span className="nav-icon">✕</span>
                <span>Removals</span>
              </button>
            </div>

            <div className="nav-divider" />

            <div className="nav-group">
              <div className="nav-label">Experience</div>
              <button className="nav-item">
                <span className="nav-icon">◍</span>
                <span>Core Web Vitals</span>
              </button>
            </div>

            <div className="nav-divider" />

            <div className="nav-group">
              <button className="nav-item">
                <span className="nav-icon">⛨</span>
                <span>Security &amp; Manual Actions</span>
              </button>
            </div>

            <div className="nav-divider" />

            <div className="nav-group">
              <button className="nav-item">
                <span className="nav-icon">↗</span>
                <span>Links</span>
              </button>
            </div>
          </nav>
        </aside>

        <main className="content-panel">
          <h1 className="page-title">Sitemaps</h1>

          <section className="panel add-panel">
            <h2>Add a new sitemap</h2>
            <div className="add-form">
              <input aria-label="Sitemap URL" placeholder="Enter sitemap URL" />
              <button type="button">SUBMIT</button>
            </div>
          </section>

          <section className="panel table-panel">
            <div className="table-header-row">
              <h2>Submitted sitemaps</h2>
              <button className="table-toggle" aria-label="Table options">
                ▤
              </button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Sitemap</th>
                    <th>Type</th>
                    <th>Submitted</th>
                    <th>Last read</th>
                    <th>Status</th>
                    <th>Discovered pages</th>
                    <th>Discovered videos</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div className="sitemap-url">https://duutaay.xyz/si</div>
                      <div className="sitemap-url">temap.xml</div>
                    </td>
                    <td>Unknown</td>
                    <td>Sep 20, 2026</td>
                    <td>—</td>
                    <td>
                      <span className="status error">Couldn't fetch</span>
                    </td>
                    <td>0</td>
                    <td>0</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pager">
              <label>
                Rows per page:
                <select defaultValue="10" aria-label="Rows per page">
                  <option value="10">10</option>
                </select>
              </label>
              <div className="pager-controls">
                <span>1–1 of 1</span>
                <button aria-label="Previous page">‹</button>
                <button aria-label="Next page">›</button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
