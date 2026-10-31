'use client';

import { useApp } from '@/store/useApp';
import { PLACE_LABEL, type PlaceKind } from '@/town/map';
import { IconMove } from './icons';

/** 공용 건물(카페·내 집·명예의 전당) 옮기기 버튼 */
export default function MovePlaceButton({ place }: { place: PlaceKind }) {
  return (
    <button className="btn btn-sm" style={{ height: 36, padding: '0 10px' }} title="빈 부지로 건물 옮기기" onClick={() => useApp.getState().startMove({ kind: 'place', place, title: PLACE_LABEL[place] })}>
      <IconMove /> 옮기기
    </button>
  );
}
