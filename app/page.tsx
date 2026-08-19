"use client";

import { useEffect, useMemo, useState } from "react";
import { FilterPanel } from "@/components/filters/FilterPanel";
import { ApartmentCard } from "@/components/listing/ApartmentCard";
import { ApartmentDetail } from "@/components/listing/ApartmentDetail";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  getApartmentId,
  hideApartment,
  matchesFilters,
  matchesSearch,
  readFavorites,
  readFilters,
  readHidden,
  readSort,
  sortApartments,
  toggleFavorite,
  unhideApartment,
  writeFilters,
  writeSort,
  type FilterState,
  type SortDirection,
  type SortState,
} from "@/lib/filters";
import { loadApartmentsWithCache } from "@/lib/storage";
import {
  getFilterableFields,
  getSortableFields,
  type Apartment,
  type SyncConfig,
} from "@/lib/schema";
import styles from "./page.module.css";

type Tab = "all" | "favorites" | "hidden";

function SortChips({
  sort,
  fields,
  onSort,
}: {
  sort: SortState;
  fields: ReturnType<typeof getSortableFields>;
  onSort: (fieldKey: string) => void;
}) {
  const activeSort = sort ?? DEFAULT_SORT;

  return (
    <div className={styles.chips}>
      {fields.map((field) => {
        const active = activeSort.field === field.key;
        const dir = active
          ? activeSort.direction === "asc"
            ? "↑"
            : "↓"
          : "";
        return (
          <Chip
            key={field.key}
            label={`${field.label} ${dir}`.trim()}
            active={active}
            onClick={() => onSort(field.key)}
          />
        );
      })}
    </div>
  );
}

export default function HomeClient() {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [prefsReady, setPrefsReady] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Apartment | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("all");

  const filterableFields = useMemo(() => getFilterableFields(), []);
  const sortableFields = useMemo(() => getSortableFields(), []);
  const showFilters = tab === "all";

  useEffect(() => {
    setFavorites(readFavorites());
    setHidden(readHidden());
    setFilters(readFilters());
    setSort(readSort());
    setPrefsReady(true);

    loadApartmentsWithCache()
      .then((result) => {
        setApartments(result.apartments);
        setSyncConfig(result.syncConfig);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    writeFilters(filters);
  }, [filters, prefsReady]);

  useEffect(() => {
    if (!prefsReady) return;
    writeSort(sort);
  }, [sort, prefsReady]);

  const visibleApartments = useMemo(() => {
    let list = apartments;

    if (tab === "favorites") {
      list = list.filter((item) => favorites.includes(getApartmentId(item)));
    } else if (tab === "hidden") {
      list = list.filter((item) => hidden.includes(getApartmentId(item)));
    } else {
      list = list.filter((item) => !hidden.includes(getApartmentId(item)));
    }

    list = list.filter((item) => matchesSearch(item, search));

    if (showFilters) {
      list = list.filter((item) =>
        matchesFilters(item, filters, filterableFields),
      );
    }

    return sortApartments(list, sort);
  }, [
    apartments,
    favorites,
    hidden,
    tab,
    search,
    filters,
    sort,
    filterableFields,
    showFilters,
  ]);

  const showFavoritesTab = favorites.length > 0;
  const showHiddenTab = hidden.length > 0;
  const selectedId = selected ? getApartmentId(selected) : null;

  function handleSortField(fieldKey: string) {
    setSort((current) => {
      const active = current ?? DEFAULT_SORT;
      if (active.field !== fieldKey) {
        return { field: fieldKey, direction: "desc" };
      }
      const nextDirection: SortDirection =
        active.direction === "desc" ? "asc" : "desc";
      return { field: fieldKey, direction: nextDirection };
    });
  }

  function handleHide(id: string) {
    setHidden(hideApartment(id));
    if (selectedId === id) setSelected(null);
  }

  function handleUnhide(id: string) {
    setHidden(unhideApartment(id));
  }

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <h1 className={styles.logo}>PROP DROP</h1>
          <p className={styles.subtitle}>
            {loading
              ? "Se încarcă..."
              : `${visibleApartments.length} listări · București`}
          </p>
        </div>
        <div className={styles.tabs}>
          <Chip
            label="Toate"
            active={tab === "all"}
            onClick={() => setTab("all")}
          />
          {showFavoritesTab ? (
            <Chip
              label="Favorite"
              active={tab === "favorites"}
              onClick={() => setTab("favorites")}
            />
          ) : null}
          {showHiddenTab ? (
            <Chip
              label="Ascunse"
              active={tab === "hidden"}
              onClick={() => setTab("hidden")}
            />
          ) : null}
        </div>
      </header>

      <div className={styles.controls}>
        <div className={styles.sortBar}>
          <span className={styles.sortLabel}>Sortare</span>
          <SortChips
            sort={sort}
            fields={sortableFields}
            onSort={handleSortField}
          />
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>
              <Icon name="search" size={17} />
            </span>
            <input
              className={styles.search}
              placeholder="Caută zonă, camere, preț..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {showFilters ? (
            <Button
              variant="ghost"
              className={styles.filterToggle}
              onClick={() => setFiltersOpen(true)}
            >
              <Icon name="filter" size={16} />
              Filtre
            </Button>
          ) : null}
        </div>
      </div>

      <div className={styles.layout}>
        {showFilters ? (
          <aside className={styles.sidebar}>
            <div className={styles.sidebarInner}>
              <h2 className={styles.sidebarTitle}>Filtre</h2>
              <FilterPanel
                fields={filterableFields}
                filters={filters}
                onChange={setFilters}
              />
            </div>
          </aside>
        ) : null}

        <main className={styles.main}>
          {error ? <div className={styles.error}>{error}</div> : null}
          {!loading && !error && visibleApartments.length === 0 ? (
            <div className={styles.empty}>
              {tab === "favorites"
                ? "Nicio proprietate salvată."
                : tab === "hidden"
                  ? "Nicio listare ascunsă."
                  : "Nicio listare găsită."}
            </div>
          ) : null}
          <div className={styles.grid}>
            {visibleApartments.map((apartment) => {
              const id = getApartmentId(apartment);
              return (
                <ApartmentCard
                  key={id}
                  apartment={apartment}
                  favorite={favorites.includes(id)}
                  hiddenTab={tab === "hidden"}
                  onOpen={() => setSelected(apartment)}
                  onToggleFavorite={() => setFavorites(toggleFavorite(id))}
                  onHide={
                    tab === "hidden" ? undefined : () => handleHide(id)
                  }
                  onUnhide={
                    tab === "hidden" ? () => handleUnhide(id) : undefined
                  }
                />
              );
            })}
          </div>
        </main>
      </div>

      {showFilters ? (
        <BottomSheet
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title="Filtre"
        >
          <FilterPanel
            fields={filterableFields}
            filters={filters}
            onChange={setFilters}
          />
          <div className={styles.sheetActions}>
            <Button variant="primary" onClick={() => setFiltersOpen(false)}>
              Aplică filtrele
            </Button>
          </div>
        </BottomSheet>
      ) : null}

      <BottomSheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Detalii apartament"
      >
        {selected && selectedId ? (
          <ApartmentDetail
            apartment={selected}
            hidden={tab === "hidden" || hidden.includes(selectedId)}
            onHide={
              tab === "hidden" || hidden.includes(selectedId)
                ? undefined
                : () => handleHide(selectedId)
            }
            onUnhide={
              tab === "hidden" || hidden.includes(selectedId)
                ? () => handleUnhide(selectedId)
                : undefined
            }
          />
        ) : null}
      </BottomSheet>

      {syncConfig.groups ? (
        <footer className={styles.footer}>
          Ultima sincronizare grupuri:{" "}
          {Object.values(syncConfig.groups).sort().at(-1) ?? "—"}
        </footer>
      ) : null}
    </div>
  );
}
