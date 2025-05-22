import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import styles from "../styles/BuildingsPage.module.css";

// 요약 카드 컴포넌트
function SummaryCard({ title, value }) {
  return (
    <div className={styles.summaryCard}>
      <div className={styles.cardTitle}>{title}</div>
      <div className={styles.cardValue}>{value}</div>
    </div>
  );
}

// 건물 카드 컴포넌트
function BuildingCard({ building }) {
  const cracks = building.waypoints
    ? building.waypoints.flatMap(
        (wp) => wp.cracks?.map((c) => ({ ...c, waypointLabel: wp.label })) || []
      )
    : [];

  const lastChecked = cracks.length
    ? cracks.reduce((a, b) =>
        new Date(a.timestamp) > new Date(b.timestamp) ? a : b
      ).timestamp
    : null;

  const crackCount = cracks.length;
  const maxWidth = cracks.length
    ? Math.max(...cracks.map((c) => c.widthMm || 0))
    : 0;
  const avgWidth = cracks.length
    ? (cracks.reduce((s, c) => s + (c.widthMm || 0), 0) / crackCount).toFixed(2)
    : 0;

  // 크랙 타입 목록 추출
  const crackTypes = [...new Set(cracks.map((c) => c.crackType))];

  return (
    <div className={styles.buildingCard}>
      <div className={styles.infoTop}>
        <h3 className={styles.buildingTitle}>{building.name}</h3>
        <p className={styles.address}>{building.address || "\u00A0"}</p>
        <div className={styles.crackTags}>
          {crackTypes.length > 0 ? (
            crackTypes.map((t) => (
              <span key={t} className={styles.crackTag}>
                {t}
              </span>
            ))
          ) : (
            <span className={styles.crackTag}>크랙 없음</span>
          )}
        </div>
      </div>

      <div className={styles.imagePlaceholder}>
        {building.thumbnail ? (
          <img
            src={building.thumbnail}
            alt={`${building.name} 균열 확장 이미지`}
            className={styles.buildingImage}
          />
        ) : (
          "[균열 확장 이미지]"
        )}
      </div>

      <div className={styles.infoBottom}>
        <div className={styles.metrics}>
          <p>
            균열 수: <strong>{crackCount}</strong>
          </p>
          <p>
            최대 균열 폭: <strong>{maxWidth} mm</strong>
          </p>
          <p>
            평균 균열 폭: <strong>{avgWidth} mm</strong>
          </p>

          <div className={styles.metricRow}>
            <span>
              마지막 점검일:{" "}
              <strong>
                {lastChecked
                  ? new Date(lastChecked).toLocaleDateString("ko-KR")
                  : "-"}
              </strong>
            </span>
            <Link
              to={`/building/${building.id}`}
              className={styles.dashboardBtn}
            >
              대시보드 바로가기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// 메인 페이지 컴포넌트
function BuildingList() {
  const [buildings, setBuildings] = useState([]);
  const [filteredBuildings, setFilteredBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState([]);

  // mm 단위에 맞춘 위험도 계산
  const getCrackSeverity = (maxWidthMm) => {
    if (maxWidthMm == null) return "관찰";
    if (maxWidthMm >= 0.3) return "심각";
    if (maxWidthMm >= 0.2) return "주의";
    return "관찰";
  };

  // 초기 데이터 로드
  useEffect(() => {
    fetch(`${API_BASE_URL}/buildings`)
      .then((res) => {
        if (!res.ok) throw new Error("건물 데이터 로드 실패");
        return res.json();
      })
      .then((data) => {
        setBuildings(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  // 검색 & 필터 적용
  useEffect(() => {
    if (loading || error) return;

    const term = searchTerm.trim().toLowerCase();
    let result = buildings.filter((b) => {
      // 검색어 매칭
      return (
        !term ||
        b.name?.toLowerCase().includes(term) ||
        b.address?.toLowerCase().includes(term)
      );
    });

    // 심각도 필터링
    if (activeFilters.length > 0) {
      result = result.filter((b) => {
        const widths = b.waypoints
          ? b.waypoints.flatMap(
              (wp) =>
                wp.cracks?.map((c) => c.widthMm).filter((w) => w != null) || []
            )
          : [];
        const maxWidth = widths.length ? Math.max(...widths) : null;
        const severity = getCrackSeverity(maxWidth);
        return activeFilters.includes(severity);
      });
    }

    setFilteredBuildings(result);
  }, [buildings, searchTerm, activeFilters, loading, error]);

  // 요약 통계
  const crackStats = useMemo(() => {
    let totalCracks = 0;
    const stats = [];

    buildings.forEach((b) => {
      const widths = b.waypoints
        ? b.waypoints.flatMap(
            (wp) =>
              wp.cracks?.map((c) => c.widthMm).filter((w) => w != null) || []
          )
        : [];
      const count = widths.length;
      totalCracks += count;
      if (count > 0) {
        stats.push({
          id: b.id,
          name: b.name,
          crackCount: count,
          maxWidth: Math.max(...widths),
          avgWidth: widths.reduce((s, w) => s + w, 0) / count,
        });
      }
    });

    const sortBy = (key) =>
      [...stats].sort((a, b) => b[key] - a[key]).slice(0, 3);

    return {
      totalCracks,
      sortedByCount: sortBy("crackCount"),
      sortedByWidth: sortBy("maxWidth"),
      sortedByAvgWidth: sortBy("avgWidth"),
    };
  }, [buildings]);

  if (loading) return <div className={styles.loading}></div>;
  if (error) return <div className={styles.error}>오류: {error}</div>;

  const { totalCracks, sortedByCount, sortedByWidth, sortedByAvgWidth } =
    crackStats;

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.mainContent}>
          {/* 요약 카드 */}
          <div className={styles.summaryGrid}>
            <SummaryCard title="총 건물 수" value={`${buildings.length}`} />
            <SummaryCard title="발견된 균열 수" value={`${totalCracks}`} />
            <SummaryCard
              title="건물별 균열 수 순위"
              value={
                <table className={styles.rankTable}>
                  <tbody>
                    {sortedByCount.length ? (
                      sortedByCount.map((b, i) => (
                        <tr key={b.id}>
                          <td>{i + 1}</td>
                          <td>{b.name}</td>
                          <td>{b.crackCount}건</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3}>데이터 없음</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              }
            />
            <SummaryCard
              title="건물별 최대 균열 폭 순위"
              value={
                <table className={styles.rankTable}>
                  <tbody>
                    {sortedByWidth.length ? (
                      sortedByWidth.map((b, i) => (
                        <tr key={b.id}>
                          <td>{i + 1}</td>
                          <td>{b.name}</td>
                          <td>{b.maxWidth.toFixed(1)} mm</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3}>데이터 없음</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              }
            />
            <SummaryCard
              title="평균 균열 폭 순위"
              value={
                <table className={styles.rankTable}>
                  <tbody>
                    {sortedByAvgWidth.length ? (
                      sortedByAvgWidth.map((b, i) => (
                        <tr key={b.id}>
                          <td>{i + 1}</td>
                          <td>{b.name}</td>
                          <td>{b.avgWidth.toFixed(1)} mm</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3}>데이터 없음</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              }
            />
          </div>

          {/* 검색 & 필터 */}
          <div className={styles.controlBar}>
            <div className={styles.searchWrapper}>
              <img
                src="/search_icon.svg"
                alt="검색 아이콘"
                className={styles.searchIcon}
              />
              <input
                type="text"
                placeholder="검색어를 입력하세요"
                className={styles.searchInput}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className={styles.buttonGroup}>
              {["심각", "주의", "관찰"].map((f) => (
                <button
                  key={f}
                  className={
                    activeFilters.includes(f) ? styles.activeFilter : ""
                  }
                  onClick={() => {
                    setActiveFilters((prev) =>
                      prev.includes(f)
                        ? prev.filter((x) => x !== f)
                        : [...prev, f]
                    );
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* 건물 카드 그리드 */}
          <div className={styles.buildingGrid}>
            {filteredBuildings.length > 0 ? (
              filteredBuildings.map((b) => (
                <BuildingCard key={b.id} building={b} />
              ))
            ) : (
              <div className={styles.noResults}>검색 결과가 없습니다.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BuildingList;
