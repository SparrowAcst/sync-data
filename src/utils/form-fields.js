const { capitalize, isNull, isUndefined, isArray, keys } = require("lodash")



const getName = field => capitalize(field.split("_").join(" "))

const optional = () => true

const required = (form, field) => ( !isNull(form[field]) && !isUndefined(form[field]) ) 
                                    ? true
                                    : `<strong>"${getName(field)}"</strong>`

const notEmpty = (form, field) => ( isArray(form[field]) && form[field].length > 0 )
                                    ? true
                                    : `<strong>"${getName(field)}"</strong>`

const notEmptyAlt = (form, field, alt) => {
    let res = notEmpty(form, field)
    if( res != true){
        res = required(form, alt)
    }
    return res
}

const condRequired = (form, field, value, list) => {
        
        list = (isArray(list)) ? list : [list]
        let res = []
        
        res.push(required(form,field))
        if(res[0] == true){
            if(form[field] == value) {
                list.forEach( l => {
                    res.push( required(form,l))    
                })
            }    
        }
        res = res.filter(d => d != true)
        
        return (res.length == 0) ? true : res.join("\n")
 
 }

const condRequiredAlt = (form, field, value, alt) => {
        
        let res = []
        res.push(required(form,field))
        if(res[0] == true){
            if(form[field] == value) {
                res.push( required(form, alt))    
            }    
        }
        res = res.filter(d => d != true)
        
        return (res.length == 0) ? true : res.join("\n")
 
 }




const rules = {
   "patient": {
        "age": required,
        "sex_at_birth": required,
        "ethnicity": required,
        "height": required,
        "weight": required,
        "bmi": required,
        "oxygen_saturation": required,
        "athlete": required,
        "blood_pressure_diasystolic": required,
        "blood_pressure_systolic": required,
        "angina": (form, field) => condRequired(form, field, "Yes", ["functional_class_canadian_cardiovascular_society", "vasospastic_and_resting_angina_pectoris"]),
        "heart_failure_choice": (form, field) => condRequired(form, field, "Yes", ["heart_failure_type", "functional_class_nyha"]), 
        "atrial_fibrillation": (form, field) => condRequired(form, field, "Yes", "atrial_fibrillation_type"),
        "atrial_flutter": (form, field) => condRequired(form, field, "Yes", "atrial_flutter_type"),
        "pregnancy": (form, field) => condRequired(form, field, "Yes", "pregnancy_weeks"),
        "known_smoker": required,
        "alcohol_abuse": required,
        "arterial_hypertension": (form, field) => condRequired(form, field, "Yes", "arterial_hypertension_grade"),
        "known_diabetes_mellitus": required,
        "known_hypothyroidism": required,
        "known_hyperthyroidism": required,
        "known_anemia": required,
        "known_cancer": required,
        "known_liver_cirrhosis": required,
        "known_reduced_renal_function_without_hemodialysis_or_peritoneal_dialysis": required,
        "known_hemodialysis_or_peritoneal_dialysis": required,
        "pneumonia_at_the_time_of_the_examination": required,
        "fever_or_active_infection_at_the_time_of_examination": required,
        "serious_general_illness_at_the_time_of_examination": required,
        "known_bradyarrhythmias_at_any_time": required,
        "known_obliterating_disease_of_the_peripheral_arteries": required,
        "stroke_or_intracranial_hemorrhage_at_any_time": required,
        "rheumatic_heart_disease": required,    
        "successful_cardiac_resuscitation_or_sustained_ventricular_tachycardia_in_the_past": required,
        "acute_coronary_syndrome_at_the_time_of_examination": (form, field) => condRequired(form, field, "Yes", ["acute_coronary_syndrome_at_the_time_of_examination_type", "killip_classification"]),
        "right_ventricular_infarction": required,
        "past_history_of_acute_coronary_syndrome": (form, field) => condRequired(form, field, "Yes", "past_history_of_acute_coronary_syndrome_type"),
        "carotid_stenosis": (form, field) => condRequired(form, field, "Present", "carotid_stenosis_type"), 
        "arterio_venous_fistula": required,
        "coronary_angiography_results": required,
        "pulmonary_hypertension": required,
        "pulmonary_embolism": required,
        "cardiomyopathy": (form, field) => condRequired(form, field, "Yes", "cardiomyopathy_type"),
        "myocarditis": required,
        "infective_endocarditis": required,
        "pericarditis": required,
        "left_ventricular_noncompaction": required,        
        "leg_edema": required,
        "ascites": required,
        "congestive_rales": required,
        "signs_of_bronchoobstruction_and_respiratory_failure": required,
        "known_respiratory_failure_of_any_cause": required,
        "present_respiratory_diseases": optional, //manyOf
        "clinical_diagnosis": required,
        "changes_recording":notEmpty, //manyOf
        "comment_recording": optional
   },
   

   "ekg": {
        
        "heart_rate_bpm": required,
        "electric_axis_of_the_heart": required,
        "rhythm": (form, field) => notEmptyAlt(form, field, "other", "rhythm_other"), // manyOf
            // "rhythm_other"
        "av_blockade": required,
        "pr_interval": required,
        "qt_interval": required,
        "intraventricular_blocks": notEmpty, // manyOf
        "preexcitation_syndrom": (form, field) => condRequiredAlt(form, field, "other", "preexcitation_syndrom_other"),
            // "preexcitation_syndrom_other",
        "abnormal_q_waves": required,
        "ischemic_st_segment_depression": required,
        "ischemic_st_segment_elevation": required,
        "anomalous_negative_t_wave": required,
        "signs_of_an_enlarged_left_atrium": required,
        "signs_of_right_atrial_enlargement": required,
        "signs_of_right_ventricular_hypertrophy": required,
        "signs_of_left_ventricular_hypertrophy": required,
        "brugada_pattern": required,
        "additional_information": optional
   },

   "echo": {
        "echocardiographic_machine": (form, field) => condRequired(form, field, "other", "echocardiographic_machine_other_name"),
        "quality_of_visualization": required,
        "lvot_cannot_visualize": (form, field) => condRequired(form, field, false, "lvot"),
        "aortic_ring_cannot_visualize": (form, field) => condRequired(form, field, false, "aortic_ring"),
        "sinus_of_valsalva_cannot_visualize": (form, field) => condRequired(form, field, false, "sinus_of_valsalva"),
        "sino_tubular_junction_cannot_visualize": (form, field) => condRequired(form, field, false, "sino_tubular_junction"),
        "ascending_aorta_cannot_visualize": (form, field) => condRequired(form, field, false, "ascending_aorta"),
        "arch_of_the_aorta_cannot_visualize": (form, field) => condRequired(form, field, false, "arch_of_the_aorta"),
        "aortic_aneurysm": required,
        "aortic_dissection": required,
        "maximum_diameter_of_the_left_atrium_cannot_visualize": (form, field) => condRequired(form, field, false, "maximum_diameter_of_the_left_atrium"),
        "maximum_volume_of_the_left_atrium_cannot_visualize": (form, field) => condRequired(form, field, false, "maximum_volume_of_the_left_atrium"),
        "left_atrium_area_cannot_visualize": (form, field) => condRequired(form, field, false, "left_atrium_area"),
        "maximum_diastolic_dimension_of_interventricular": (form, field) => condRequired(form, field, false, "maximum_diastolic_dimension_of_interventricular"),    
        "maximum_diastolic_dimension_of_left_ventricular_cannot_visualize" : (form, field) => condRequired(form, field, false, "maximum_diastolic_dimension_of_left_ventricular"),    
        "lv_end_diastolic_dimension_cannot_visualize": (form, field) => condRequired(form, field, false, "lv_end_diastolic_dimension"),
        "lv_end_systolic_dimension_cannot_visualize": (form, field) => condRequired(form, field, false, "lv_end_systolic_dimension"),
        "lv_end_diastolic_volume_cannot_visualize": (form, field) => condRequired(form, field, false, "lv_end_diastolic_volume"),   
        "lv_end_systolic_volume_cannot_visualize": (form, field) => condRequired(form, field, false, "lv_end_systolic_volume"),
        "diastolic_function_of_the_left_ventricle": required,
        "e_a_cannot_visualize": (form, field) => condRequired(form, field, false, "e_a"),
        "septal_cannot_visualize": (form, field) => condRequired(form, field, false, "septal"),
        "lateral_cannot_visualize": (form, field) => condRequired(form, field, false, "lateral"),
        //////////////////////////////////////////////////////////////////////////
        "regional_abnormalities_of_left_ventricular_contractility": required,
        // Present
        // ///////////////////////////////////////////////////////////////////////
        "right_ventricle_free_wall_thickness": required,
        "mid_rv_measured_four_chamber_view": required,
        "tricuspid_annular_plane_systolic_excursion": required,
        ///////////////////////////////////////////////////////////////////////////    
        "regional_abnormalities_right_ventricular_contractility": required,
        // Present
        // ///////////////////////////////////////////////////////////////////////
        "maximum_volume_right_atrium_cannot_visualize": (form, field) => condRequired(form, field, false, "maximum_volume_right_atrium"),
        "mitral_ring": required,
        "mitral_valve_prolapse": required,
        "mitral_regurgitation": optional,
        "mitral_stenosis": required,
        "aortic_valve": required,
        ///////////////////////////////////////////////////////////////////////////
        "aortic_regurgitation": required,
        // Present
        // ///////////////////////////////////////////////////////////////////////
        "aortic_stenosis": required,
        // Present
        // ///////////////////////////////////////////////////////////////////////
        "tricuspid_regurgitation": required,
        // Present
        // ///////////////////////////////////////////////////////////////////////
        "tricuspid_stenosis": required,
        // Present
        // ///////////////////////////////////////////////////////////////////////
        "pulmonary_regurgitation": required,
        // Present
        // ///////////////////////////////////////////////////////////////////////
        "pulmonary_stenosis": required,
        // Present
        // ///////////////////////////////////////////////////////////////////////
        "valve_prostheses": required,
        "pericardial_effusion": required,
        "pericardial_constriction": required,

        "maximum_diameter_inferior_vena_cava_cannot_visualize": (form, field) => condRequired(form, field, false, "maximum_diameter_inferior_vena_cava"),
        "minimum_diameter_of_inferior_vena_cava_on_inspiration_cannot_visualize": (form, field) => condRequired(form, field, false, "minimum_diameter_of_inferior_vena_cava_on_inspiration"),       
        "fluid_pleural_cavities": required,
        ///////////////////////////////////////////////////////////////////////////
        "congenital_heart_disease": required,
        // Yes
        // ///////////////////////////////////////////////////////////////////////
        "vegetations": required,
        // Yes
        // ///////////////////////////////////////////////////////////////////////
        "intracavitary_thrombi": required,
        // Yes
        // ///////////////////////////////////////////////////////////////////////
        "heart_tumors": required,
        "conclusion": required,

    // "average",
    // 
    // 
    // "ra_volume_index",
    // "e_m_s_cannot_visualize",
    // "regional_abnormalities_of_left_ventricular_contractility",
    // 
    // "inferior_vena_cava_collapse_inspiration",
    // "ef",
    // "ef_cannot_visualize",
    // "la_volume_index",
    // "quality_of_visualization",
    // "maximum_diastolic_dimension_of_left_ventricular_cannot_visualize",
    // "body_surface_area",
    // "maximum_diastolic_dimension_of_interventricular_cannot_visualize",
    // "e_m_s",
    // "inferior_vena_cava_collapse_inspiration_cannot_visualize",
    // "aortic_valve_stage",
    // "vena_contracta_2",
    // "ava_Aortic_valve_orifice_area_cannot_visualize",
    // "vena_contracta_2_cannot_visualize",
    // "eroa",
    // "ero_cannot_visualize",
    // "right_atrium_stage",
    // "peak_pressure_gradient_mercury_column_cannot_visualize",
    // "pressure_half_time_cannot_visualize",
    // "eroa_cannot_visualize",
    // "ero",
    // "vena_contracta_cannot_visualize",
    // "mitral_regurgitation",
    // "aortic_valve_orifice_area_index",
    // "peak_pressure_gradient_mercury_column",
    // "regurgitant_volume",
    // "mitral_regurgitation_flow_area",
    // "mitral_regurgitation_flow_area_cannot_visualize",
    // "rvol",
    // "rvol_cannot_visualize",
    // "ava_Aortic_valve_orifice_area",
    // "mitral_regurgitation_flow_area_left_atrium_area",
    // "pressure_half_time",
    // "regurgitant_volume_cannot_visualize",
    // "vena_contracta",
    // "aortic_valve_stage2",
    // "end_diastolic_distance_echo_free_space",
    // "cardiac_tamponade",
    // "end_diastolic_distance_echo_free_space_cannot_visualize",
    // "basal_lv_anteroseptal",
    // "mid_lv_inferoseptal",
    // "basal_lv_inferior",
    // "apical_cap",
    // "apical_lv_septal",
    // "mid_lv_anterior",
    // "apical_lv_inferior",
    // "basal_lv_inferoseptal",
    // "mid_lv_anterolateral",
    // "mid_lv_anteroseptal",
    // "mid_lv_inferolateral",
    // "apical_lv_anterior",
    // "mid_lv_inferior",
    // "basal_lv_anterolateral",
    // "basal_lv_inferolateral",
    // "basal_lv_anterior",
    // "apical_lv_lateral",
    // "blood_flow_area_tricuspid_regurgitation_cannot_visualize",
    // "tr_velocity",
    // "peak_pressure_gradient_mercury_column_4_cannot_visualize",
    // "vena_contracta_tricuspid_regurgitation_cannot_visualize",
    // "vena_contracta_tricuspid_regurgitation",
    // "tricuspid_valve_stage",
    // "peak_pressure_gradient_mercury_column_4",
    // "blood_flow_area_tricuspid_regurgitation",
    // "tr_velocity_cannot_visualize",
    // "myxomatous_degeneration",
    // "prosthetic_tricuspid_valve_tissue",
    // "prosthetic_mitral_valve_tissue",
    // "prosthetic_pulmonary_valve_mechanical",
    // "prosthetic_aortic_valve_tissue",
    // "prosthetic_tricuspid_valve_mechanical",
    // "prosthetic_pulmonary_valve_tissue",
    // "prosthetic_aortic_valve_mechanical",
    // "prosthetic_mitral_valve_mechanical",
    // "pulmonary_valve_stage",
    // "intracavitary_thrombi_multi",
    // "ebstein_anomaly_tricuspid_valve",
    // "bicuspid_aortic_valve",
    // "other_congenital_heart_disease",
    // "atrial_septal_defect",
    // "aortic_coarctation",
    // "tetralogy_fallot",
    // "atrioventricular_septal_defect",
    // "ventricular_septal_defect",
    // "patent_ductus_arteriosus",
    // "anterior_rv",
    // "anterior_rvot",
    // "inferior_rv",
    // "lateral_rv",
    // "vegetations_multi",
    // "right_atrium_stage2",
    // "pressure_half_time_2",
    // "planimetrically_mva",
    // "planimetrically_mva_cannot_visualize",
    // "pressure_half_time_2_cannot_visualize",
    // "peak_doppler_gradient_cannot_visualize",
    // "peak_doppler_gradient",
    // "pulmonary_valve_stage2",
    // "mean_doppler_gradient",
    // "mean_doppler_gradient_cannot_visualize",
   }
}


const validate = (formType, instance) => {
    let res = []
    keys(rules[formType]).forEach( f => {
        try {
            res.push(rules[formType][f](instance, f))
        } catch (e) {
            res.push(`Couldn't validate field "${f}"\n${e.toString()}\nrules[formType][f]`)
        }
    })

    return res
}  

const getFieldNames = formType => keys(rules[formType]).map( d => getName(d)) 


module.exports = {
    getName,
    validate,
    getFieldNames
}