<?php
declare(strict_types=1);
require dirname(__DIR__).'/membership_rules.php';

$assertSame=static function(mixed $expected,mixed $actual,string $case): void {
    if ($expected!==$actual) throw new RuntimeException($case.': expected '.var_export($expected,true).', received '.var_export($actual,true));
};

$assertSame(['washer'=>1,'dryer'=>0],self_service_line_machines('SELF-CUCI',5),'Wash only 5 kg');
$assertSame(['washer'=>3,'dryer'=>0],self_service_line_machines('SELF-CUCI',15),'Wash only 15 kg');
$assertSame(['washer'=>0,'dryer'=>1],self_service_line_machines('SELF-KERING',5),'Dry only 5 kg');
$assertSame(['washer'=>2,'dryer'=>2],self_service_line_machines('SELF-CUCI-KERING',10),'Wash and dry 10 kg');
$assertSame(['washer'=>0,'dryer'=>1],self_service_line_machines('SELF-EXTRA-DRY',5),'Extra dry uses one dryer');

$mixedLines=[
    self_service_line_machines('SELF-CUCI',5),
    self_service_line_machines('SELF-CUCI-KERING',5),
    self_service_line_machines('SELF-KERING',5),
];
$assertSame(2,array_sum(array_column($mixedLines,'washer')),'Mixed self-service washer totals');
$assertSame(2,array_sum(array_column($mixedLines,'dryer')),'Mixed self-service dryer totals');
$assertSame('award',membership_stamp_outcome(true,true,false,0,12),'First valid visit earns one stamp');
$assertSame('award',membership_stamp_outcome(true,true,false,0,6),'Student member follows the same stamp rule');
$assertSame('already_stamped',membership_stamp_outcome(true,true,true,1,12),'Second visit on same date does not earn another stamp');
$assertSame('card_full',membership_stamp_outcome(true,true,false,12,12),'Full card cannot receive more stamps');
$assertSame('not_self_service',membership_stamp_outcome(true,false,false,0,12),'Drop Off does not earn stamps');
$assertSame('ineligible',membership_stamp_outcome(false,true,false,0,12),'Inactive member cannot earn stamps');

$assertSame(1,dropoff_dry_unit_count(5),'Drop Off dry 5 kg');
$assertSame(1,dropoff_dry_unit_count(7),'Drop Off dry 7 kg');
$assertSame(3,dropoff_dry_unit_count(15),'Drop Off dry 15 kg');
$assertSame(36000,dropoff_dry_unit_count(15)*12000,'Drop Off dry 15 kg price');

$assertSame(true,membership_service_selection_is_valid(['Drop Off'],['DROP-CUCI-KERING']),'Drop Off wash and dry');
$assertSame(true,membership_service_selection_is_valid(['Drop Off'],['DROP-KERING']),'Drop Off dry only');
$assertSame(true,membership_service_selection_is_valid(['Drop Off'],['DROP-LIPAT']),'Drop Off fold only');
$assertSame(true,membership_service_selection_is_valid(['Setrika Saja'],['SET-REG']),'Iron only');
$assertSame(true,membership_service_selection_is_valid(['Drop Off','Setrika Saja'],['DROP-KERING','SET-REG']),'Drop Off dry and iron');
$assertSame(true,membership_service_selection_is_valid(['Drop Off'],['DROP-KERING','DROP-LIPAT']),'Drop Off dry and fold');
$assertSame(false,membership_service_selection_is_valid(['Drop Off'],['DROP-CUCI']),'Drop Off wash only is rejected');
$assertSame(false,membership_service_selection_is_valid(['Self Service','Drop Off'],['SELF-CUCI','DROP-KERING']),'Self Service and Drop Off cannot mix');
$assertSame(false,membership_service_selection_is_valid(['Drop Off','Setrika Saja'],['DROP-LIPAT','SET-REG']),'Unapproved Drop Off combination is rejected');

echo "Membership/service rule checks passed.\n";
