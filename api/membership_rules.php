<?php
declare(strict_types=1);

function self_service_line_machines(string $serviceCode,float $weightKg): array {
    if (!is_finite($weightKg) || $weightKg<=0) throw new InvalidArgumentException('Berat Self Service harus positif dan valid.');
    $machines=(int)ceil(round($weightKg,2)/7);
    return [
        'washer'=>in_array($serviceCode,['SELF-CUCI','SELF-CUCI-KERING','SELF-SPIN'],true)?$machines:0,
        'dryer'=>in_array($serviceCode,['SELF-KERING','SELF-CUCI-KERING','SELF-EXTRA-DRY'],true)?$machines:0,
    ];
}

function dropoff_dry_unit_count(float $weightKg): int {
    if (!is_finite($weightKg) || $weightKg<=0) throw new InvalidArgumentException('Berat Drop Off harus positif dan valid.');
    return (int)ceil(round($weightKg,2)/7);
}

function membership_service_selection_is_valid(array $categories,array $serviceCodes): bool {
    $categories=array_values(array_unique($categories));
    $serviceCodes=array_values(array_unique($serviceCodes));
    if (in_array('Self Service',$categories,true) && count($categories)>1) return false;
    $containsDropOff=in_array('Drop Off',$categories,true) || in_array('Setrika Saja',$categories,true);
    if (!$containsDropOff) return count($categories)<=1;
    $allowedCategories=count($categories)===1
        && in_array($categories[0],['Drop Off','Setrika Saja'],true);
    $allowedCategories=$allowedCategories
        || (count($categories)===2 && in_array('Drop Off',$categories,true) && in_array('Setrika Saja',$categories,true));
    if (!$allowedCategories) return false;
    sort($serviceCodes);
    $allowedCodes=[
        ['DROP-CUCI-KERING'],['DROP-KERING'],['DROP-LIPAT'],['SET-REG'],['SET-EXP'],
        ['DROP-KERING','DROP-LIPAT'],['DROP-KERING','SET-REG'],['DROP-KERING','SET-EXP'],
    ];
    foreach ($allowedCodes as $codes) {
        sort($codes);
        if ($serviceCodes===$codes) return true;
    }
    return false;
}

function membership_stamp_outcome(bool $memberActive,bool $selfService,bool $alreadyStamped,int $stampCount,int $stampSlots): string {
    if (!$memberActive) return 'ineligible';
    if (!$selfService) return 'not_self_service';
    if ($alreadyStamped) return 'already_stamped';
    if ($stampSlots<=0 || $stampCount>=$stampSlots) return 'card_full';
    return 'award';
}
